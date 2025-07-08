var Game = {
    width: 40,
    height: 24,
    map: [],
    hero: {
        x: 0,
        y: 0,
        health: 100,
        maxHealth: 100,
        attackPower: 1
    },
    enemies: [],
    swords: [],
    potions: [],
    
    config: {
        heroBaseDamage: 20,
        enemyBaseDamage: 10,
        potionHeal: 50,
        controls: {
            left: 65,
            right: 68,
            up: 87,
            down: 83,
            attack: 32
        },
        enemyCount: 10,
        swordCount: 2,
        potionCount: 10
    },

    helpers: {
        renderHealthBar: function(entity) {
            return '<div class="health" style="width: ' + (entity.health / entity.maxHealth * 100) + '%;"></div>';
        },
        
        isNearby: function(entity1, entity2) {
            return Math.abs(entity1.x - entity2.x) <= 1 && Math.abs(entity1.y - entity2.y) <= 1;
        },
        
        checkItem: function(items, effect) {
            for (var i = items.length - 1; i >= 0; i--) {
                if (items[i].x === this.hero.x && items[i].y === this.hero.y) {
                    effect(items[i]);
                    items.splice(i, 1);
                }
            }
        },

        getNeighbors: function(pos) {
            return [
                {x: pos.x - 1, y: pos.y},
                {x: pos.x + 1, y: pos.y},
                {x: pos.x, y: pos.y - 1},
                {x: pos.x, y: pos.y + 1}
            ];
        },

        isValidPosition: function(pos) {
            return pos.x >= 0 && pos.x < this.width &&
                   pos.y >= 0 && pos.y < this.height;
        },

        shuffle: function(array) {
            for (var i = array.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = array[i];
                array[i] = array[j];
                array[j] = temp;
            }
            return array;
        },

        placeEntity: function(count, createEntity) {
            var entities = [];
            for (var i = 0; i < count; i++) {
                var pos = this.findEmptyPosition();
                var entity = createEntity(pos);
                entities.push(entity);
            }
            return entities;
        },

        handleAttack: function(attacker, targets, baseDamage, onDeath) {
            for (var i = targets.length - 1; i >= 0; i--) {
                var target = targets[i];
                if (Game.helpers.isNearby(target, attacker)) {
                    target.health -= attacker.attackPower * baseDamage;
                    if (target.health <= 0 && onDeath) {
                        onDeath(target, i);
                    }
                }
            }
        }
    },

    init: function() {
        this.generateMap();
        this.generateRooms();
        this.generateCorridors();
        this.checkMapConnectivity();
        this.placeItems();
        this.placeCharacters();
        this.setupControls();
        this.render();
    },

    generateMap: function() {
        for (var y = 0; y < this.height; y++) {
            this.map[y] = [];
            for (var x = 0; x < this.width; x++) {
                this.map[y][x] = 'wall';
            }
        }
    },

    generateRooms: function() {
        var numRooms = Math.floor(Math.random() * 6) + 5;
        var rooms = [];

        for (var i = 0; i < numRooms; i++) {
            var room = this.generateRoom();
            if (this.canPlaceRoom(room, rooms)) {
                this.carveRoom(room);
                rooms.push(room);
            }
        }
    },

    generateRoom: function() {
        var width = Math.floor(Math.random() * 6) + 3;
        var height = Math.floor(Math.random() * 6) + 3;
        var x = Math.floor(Math.random() * (this.width - width - 2)) + 1;
        var y = Math.floor(Math.random() * (this.height - height - 2)) + 1;

        return {
            x: x,
            y: y,
            width: width,
            height: height
        };
    },

    canPlaceRoom: function(room, existingRooms) {
        if (room.x < 0 || room.y < 0 || 
            room.x + room.width >= this.width || 
            room.y + room.height >= this.height) {
            return false;
        }

        for (var i = 0; i < existingRooms.length; i++) {
            var existing = existingRooms[i];
            if (!(room.x + room.width + 1 < existing.x - 1 ||
                  room.x - 1 > existing.x + existing.width + 1 ||
                  room.y + room.height + 1 < existing.y - 1 ||
                  room.y - 1 > existing.y + existing.height + 1)) {
                return false;
            }
        }

        return true;
    },

    carveRoom: function(room) {
        for (var y = room.y; y < room.y + room.height; y++) {
            for (var x = room.x; x < room.x + room.width; x++) {
                this.map[y][x] = 'floor';
            }
        }
    },

    generateCorridors: function() {
        var rooms = [];
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                if (this.map[y][x] === 'floor') {
                    var room = this.findRoom(x, y);
                    if (room && !this.isRoomInList(room, rooms)) {
                        rooms.push(room);
                    }
                }
            }
        }

        for (var i = 0; i < rooms.length; i++) {
            var room = rooms[i];
            var nearestRoom = this.findNearestRoom(room, rooms);
            if (nearestRoom) {
                this.connectRooms(room, nearestRoom);
            }
        }

        var numHCorridors = Math.floor(Math.random() * 2) + 2;
        var numVCorridors = Math.floor(Math.random() * 2) + 2;
        
        for (var i = 0; i < numHCorridors; i++) {
            this.generateHorizontalCorridor();
        }
        
        for (var i = 0; i < numVCorridors; i++) {
            this.generateVerticalCorridor();
        }
    },

    findRoom: function(startX, startY) {
        var visited = {};
        var room = {
            x: startX,
            y: startY,
            maxX: startX,
            maxY: startY,
            centerX: startX,
            centerY: startY
        };

        var stack = [{x: startX, y: startY}];
        while (stack.length > 0) {
            var pos = stack.pop();
            var key = pos.x + ',' + pos.y;
            
            if (visited[key]) continue;
            visited[key] = true;

            if (this.map[pos.y][pos.x] !== 'floor') continue;

            room.x = Math.min(room.x, pos.x);
            room.y = Math.min(room.y, pos.y);
            room.maxX = Math.max(room.maxX, pos.x);
            room.maxY = Math.max(room.maxY, pos.y);

            var neighbors = this.helpers.getNeighbors(pos);
            for (var i = 0; i < neighbors.length; i++) {
                var next = neighbors[i];
                if (this.helpers.isValidPosition.call(this, next)) {
                    stack.push(next);
                }
            }
        }

        room.centerX = Math.floor((room.x + room.maxX) / 2);
        room.centerY = Math.floor((room.y + room.maxY) / 2);
        return room;
    },

    isRoomInList: function(room, rooms) {
        for (var i = 0; i < rooms.length; i++) {
            var existing = rooms[i];
            if (room.centerX === existing.centerX && room.centerY === existing.centerY) {
                return true;
            }
        }
        return false;
    },

    findNearestRoom: function(room, rooms) {
        var nearest = null;
        var minDistance = Infinity;

        for (var i = 0; i < rooms.length; i++) {
            var other = rooms[i];
            if (other === room) continue;

            var distance = Math.abs(room.centerX - other.centerX) + 
                         Math.abs(room.centerY - other.centerY);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearest = other;
            }
        }

        return nearest;
    },

    connectRooms: function(start, end) {
        var x = start.centerX || start.x;
        var y = start.centerY || start.y;
        var targetX = end.centerX || end.x;
        var targetY = end.centerY || end.y;
        
        while (x !== targetX) {
            this.map[y][x] = 'floor';
            x += (x < targetX) ? 1 : -1;
        }
        
        while (y !== targetY) {
            this.map[y][x] = 'floor';
            y += (y < targetY) ? 1 : -1;
        }
    },

    generateHorizontalCorridor: function() {
        var y = Math.floor(Math.random() * (this.height - 2)) + 1;
        for (var x = 0; x < this.width; x++) {
            this.map[y][x] = 'floor';
        }
    },

    generateVerticalCorridor: function() {
        var x = Math.floor(Math.random() * (this.width - 2)) + 1;
        for (var y = 0; y < this.height; y++) {
            this.map[y][x] = 'floor';
        }
    },

    placeItems: function() {
        this.swords = this.helpers.placeEntity.call(this, this.config.swordCount, function(pos) {
            return pos;
        });

        this.potions = this.helpers.placeEntity.call(this, this.config.potionCount, function(pos) {
            return pos;
        });
    },

    placeCharacters: function() {
        var heroPos = this.findEmptyPosition();
        this.hero.x = heroPos.x;
        this.hero.y = heroPos.y;
        this.hero.health = this.hero.maxHealth;
        this.hero.attackPower = 1;

        this.enemies = this.helpers.placeEntity.call(this, this.config.enemyCount, function(pos) {
            return {
                x: pos.x,
                y: pos.y,
                health: 100,
                maxHealth: 100,
                attackPower: 1
            };
        });
    },

    findEmptyPosition: function() {
        var x, y;
        do {
            x = Math.floor(Math.random() * this.width);
            y = Math.floor(Math.random() * this.height);
        } while (this.map[y][x] !== 'floor' || this.isPositionOccupied(x, y));
        
        return {x: x, y: y};
    },

    isPositionOccupied: function(x, y) {
        if (this.hero.x === x && this.hero.y === y) return true;

        for (var i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].x === x && this.enemies[i].y === y) return true;
        }

        for (var i = 0; i < this.swords.length; i++) {
            if (this.swords[i].x === x && this.swords[i].y === y) return true;
        }
        for (var i = 0; i < this.potions.length; i++) {
            if (this.potions[i].x === x && this.potions[i].y === y) return true;
        }

        return false;
    },

    updateUI: function() {
        $('#attack-power').text(this.hero.attackPower);
        $('.health-bar .health').css('width', (this.hero.health / this.hero.maxHealth * 100) + '%');
    },

    render: function() {
        var $field = $('.field');
        $field.empty();

        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var $tile = $('<div class="tile"></div>');
                $tile.addClass(this.map[y][x]);

                if (this.hero.x === x && this.hero.y === y) {
                    $tile.addClass('hero');
                    $tile.append(this.helpers.renderHealthBar(this.hero));
                }

                for (var i = 0; i < this.enemies.length; i++) {
                    if (this.enemies[i].x === x && this.enemies[i].y === y) {
                        $tile.addClass('enemy');
                        $tile.append(this.helpers.renderHealthBar(this.enemies[i]));
                    }
                }

                for (var i = 0; i < this.swords.length; i++) {
                    if (this.swords[i].x === x && this.swords[i].y === y) {
                        $tile.addClass('sword');
                    }
                }
                for (var i = 0; i < this.potions.length; i++) {
                    if (this.potions[i].x === x && this.potions[i].y === y) {
                        $tile.addClass('potion');
                    }
                }

                $field.append($tile);
            }
        }

        this.updateUI();
    },

    setupControls: function() {
        var self = this;
        
        $(document).off('keydown');
        $(document).on('keydown', function(e) {
            var moved = false;
            var newX = self.hero.x;
            var newY = self.hero.y;

            switch(e.keyCode) {
                case self.config.controls.left:
                    newX--;
                    moved = true;
                    break;
                case self.config.controls.right:
                    newX++;
                    moved = true;
                    break;
                case self.config.controls.up:
                    newY--;
                    moved = true;
                    break;
                case self.config.controls.down:
                    newY++;
                    moved = true;
                    break;
                case self.config.controls.attack:
                    self.heroAttack();
                    self.enemiesMove();
                    self.enemiesAttack();
                    self.render();
                    e.preventDefault();
                    return;
            }

            if (moved) {
                e.preventDefault();
                if (self.canMove(newX, newY)) {
                    self.hero.x = newX;
                    self.hero.y = newY;
                    self.checkItems();
                    self.enemiesMove();
                    self.enemiesAttack();
                    self.render();
                }
            }
        });

        $(window).on('keydown', function(e) {
            var controls = Object.values(self.config.controls);
            if(controls.indexOf(e.keyCode) > -1) {
                e.preventDefault();
            }
        });
    },

    canMove: function(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        
        var canMove = this.map[y][x] === 'floor';
        return canMove;
    },

    heroAttack: function() {
        this.helpers.handleAttack.call(this, this.hero, this.enemies, this.config.heroBaseDamage, function(enemy, index) {
            this.enemies.splice(index, 1);
        }.bind(this));
        this.render();
    },

    enemiesMove: function() {
        for (var i = 0; i < this.enemies.length; i++) {
            var enemy = this.enemies[i];
            var neighbors = this.helpers.shuffle(this.helpers.getNeighbors(enemy));
            
            for (var j = 0; j < neighbors.length; j++) {
                var newPos = neighbors[j];
                if (this.canMove(newPos.x, newPos.y) && !this.isPositionOccupied(newPos.x, newPos.y)) {
                    enemy.x = newPos.x;
                    enemy.y = newPos.y;
                    break;
                }
            }
        }
    },

    enemiesAttack: function() {
        this.helpers.handleAttack.call(this, this.hero, this.enemies, this.config.enemyBaseDamage, function() {
            alert('Игра окончена!');
            this.init();
        }.bind(this));
    },

    checkItems: function() {
        var self = this;
        
        this.helpers.checkItem.call(this, this.swords, function(sword) {
            self.hero.attackPower++;
        });

        this.helpers.checkItem.call(this, this.potions, function(potion) {
            self.hero.health = Math.min(self.hero.health + self.config.potionHeal, self.hero.maxHealth);
        });
        
        this.updateUI();
    },

    checkMapConnectivity: function() {
        var startPos = this.findFirstFloor();
        if (!startPos) return false;

        var visited = {};
        var unconnected = [];
        
        this.floodFill(startPos.x, startPos.y, visited);
        
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                if (this.map[y][x] === 'floor' && !visited[x + ',' + y]) {
                    unconnected.push({x: x, y: y});
                }
            }
        }
        
        for (var i = 0; i < unconnected.length; i++) {
            var pos = unconnected[i];
            var nearest = this.findNearestVisited(pos, visited);
            if (nearest) {
                this.connectRooms(pos, nearest);
            }
        }
    },

    findFirstFloor: function() {
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                if (this.map[y][x] === 'floor') {
                    return {x: x, y: y};
                }
            }
        }
        return null;
    },

    floodFill: function(x, y, visited) {
        var stack = [{x: x, y: y}];
        
        while (stack.length > 0) {
            var pos = stack.pop();
            var key = pos.x + ',' + pos.y;
            
            if (visited[key]) continue;
            visited[key] = true;
            
            var neighbors = this.helpers.getNeighbors(pos);
            for (var i = 0; i < neighbors.length; i++) {
                var next = neighbors[i];
                if (this.helpers.isValidPosition.call(this, next) &&
                    this.map[next.y][next.x] === 'floor') {
                    stack.push(next);
                }
            }
        }
    },

    findNearestVisited: function(pos, visited) {
        var minDist = Infinity;
        var nearest = null;
        
        for (var key in visited) {
            var coords = key.split(',');
            var x = parseInt(coords[0]);
            var y = parseInt(coords[1]);
            
            var dist = Math.abs(x - pos.x) + Math.abs(y - pos.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = {x: x, y: y};
            }
        }
        
        return nearest;
    }
};

$(document).ready(function() {
    Game.init();
}); 