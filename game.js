// ==========================================
// 1. JS Bridge System
// ==========================================
function sendToFlutterFlow(payload) {
    const jsonString = JSON.stringify(payload);
    
    // ส่งเข้า FlutterFlow WebView Channel
    if (window.FlutterChannel && window.FlutterChannel.postMessage) {
        window.FlutterChannel.postMessage(jsonString);
    }
    
    console.log("--> [Bridge Output]:", payload);

    // ถ้ามีการดรอปอุปกรณ์ ให้ส่งแสดงใน HTML Inventory Panel
    if (payload.event === 'ITEM_DROPPED') {
        if (typeof addLootToInventoryUI === 'function') {
            addLootToInventoryUI(payload.icon, payload.itemName);
        }
    }
}

// ==========================================
// 2. Phaser 3 Game Configuration
// ==========================================
const config = {
    type: Phaser.AUTO,
    width: 520,
    height: 220,
    parent: 'game-container',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// ตัวแปรฉาก และ Parallax Layers
let bgFar, bgMid, bgFloor;
let hero, pet, enemy, portal;
let enemyHp = 100, maxEnemyHp = 100;
let enemyHpBar, enemyNameText, topBanner, topBannerText, stageProgressBar;

// สถานะการเล่น
let currentStage = "2-8";
let killsInStage = 0;
const maxKillsPerStage = 5;
let isBossFight = false;
let currentTheme = 'forest';

// ==========================================
// 3. Preload & Asset Generation
// ==========================================
function preload() {
    let g = this.add.graphics();

    // --- Parallax Background Textures ---
    // 1. ธีมป่า (Forest)
    g.fillStyle(0x1a252f); g.fillRect(0, 0, 520, 220);
    g.generateTexture('bg_forest_far', 520, 220); g.clear();
    
    g.fillStyle(0x273c75); g.fillRect(0, 80, 120, 100); g.fillRect(100, 60, 150, 120);
    g.generateTexture('bg_forest_mid', 520, 220); g.clear();

    g.fillStyle(0x2bc48a); g.fillRect(0, 0, 64, 30);
    g.fillStyle(0x1e8449); g.fillRect(0, 0, 64, 4);
    g.generateTexture('bg_forest_floor', 64, 30); g.clear();

    // 2. ธีมดันเจี้ยน (Dungeon)
    g.fillStyle(0x111116); g.fillRect(0, 0, 520, 220);
    g.generateTexture('bg_dungeon_far', 520, 220); g.clear();

    g.fillStyle(0x2c3e50); g.fillRect(20, 40, 30, 140); g.fillRect(150, 40, 30, 140);
    g.generateTexture('bg_dungeon_mid', 520, 220); g.clear();

    g.fillStyle(0x7f8c8d); g.fillRect(0, 0, 64, 30);
    g.fillStyle(0x34495e); g.fillRect(0, 0, 64, 4);
    g.generateTexture('bg_dungeon_floor', 64, 30); g.clear();

    // 3. ธีมถ้ำลาวา (Lava Cave)
    g.fillStyle(0x2c0b0e); g.fillRect(0, 0, 520, 220);
    g.generateTexture('bg_lava_far', 520, 220); g.clear();

    g.fillStyle(0xb33939); g.fillRect(40, 90, 80, 90); g.fillRect(200, 70, 100, 110);
    g.generateTexture('bg_lava_mid', 520, 220); g.clear();

    g.fillStyle(0x218c74); g.fillRect(0, 0, 64, 30);
    g.fillStyle(0xff5252); g.fillRect(0, 0, 64, 4); // ลาวาเรืองแสง
    g.generateTexture('bg_lava_floor', 64, 30); g.clear();

    // --- Sprites & Items ---
    // ฮีโร่
    g.fillStyle(0xf1c40f); g.fillRect(4, 0, 16, 24);
    g.fillStyle(0x2ecc71); g.fillRect(0, 8, 24, 16);
    g.generateTexture('hero_sprite', 24, 24); g.clear();

    // สัตว์เลี้ยง (Slime, Dragon, Phoenix)
    g.fillStyle(0x3498db); g.fillRect(2, 4, 12, 12); g.generateTexture('pet_slime', 16, 16); g.clear();
    g.fillStyle(0xe74c3c); g.fillRect(0, 0, 16, 16); g.fillRect(4, 4, 4, 4); g.generateTexture('pet_dragon', 16, 16); g.clear();
    g.fillStyle(0xe67e22); g.fillRect(2, 0, 12, 16); g.fillRect(0, 4, 16, 6); g.generateTexture('pet_phoenix', 16, 16); g.clear();

    // มอนสเตอร์ธรรมดา & บอส
    g.fillStyle(0xdcdde1); g.fillRect(2, 2, 20, 22); g.generateTexture('enemy_normal', 24, 24); g.clear();
    g.fillStyle(0x8e44ad); g.fillRect(0, 0, 40, 44);
    g.fillStyle(0xe74c3c); g.fillRect(8, 8, 8, 8); g.fillRect(24, 8, 8, 8);
    g.generateTexture('enemy_boss', 40, 44); g.clear();

    // Projectiles & FX
    g.fillStyle(0xf39c12); g.fillRect(0, 2, 12, 2); g.generateTexture('arrow_sprite', 14, 6); g.clear();
    g.fillStyle(0x9b59b6); g.fillRect(0, 0, 18, 16); g.generateTexture('chest_sprite', 18, 16); g.clear();
    g.fillStyle(0xf1c40f); g.fillCircle(4, 4, 4); g.generateTexture('coin_sprite', 8, 8); g.clear();
    g.fillStyle(0xffffff); g.fillRect(0, 0, 3, 3); g.generateTexture('spark_particle', 3, 3); g.clear();

    // อุปกรณ์ไอเทมดรอป (ดาบ & เกราะ)
    g.fillStyle(0xbdc3c7); g.fillRect(6, 0, 4, 16); g.fillStyle(0xe74c3c); g.fillRect(4, 12, 8, 3);
    g.generateTexture('item_sword', 16, 16); g.clear();
}

// ==========================================
// 4. Create Scene Lifecycle
// ==========================================
function create() {
    // 1. สร้าง Parallax Scrolling Layers
    bgFar = this.add.tileSprite(260, 110, 520, 220, 'bg_forest_far');
    bgMid = this.add.tileSprite(260, 110, 520, 220, 'bg_forest_mid');
    bgFloor = this.add.tileSprite(260, 195, 520, 30, 'bg_forest_floor');

    // วงเวทใต้เท้าฮีโร่
    const magicCircle = this.add.ellipse(390, 180, 50, 14);
    magicCircle.setStrokeStyle(2, 0xe67e22);

    // ประตูมิติ
    portal = this.add.rectangle(50, 160, 24, 30, 0x0984e3);
    this.add.text(50, 130, currentStage, { fontSize: '11px', backgroundColor: '#00000088', padding: { x: 4, y: 2 } }).setOrigin(0.5);

    // ฮีโร่ & สัตว์เลี้ยง
    hero = this.add.sprite(390, 165, 'hero_sprite');
    pet = this.add.sprite(430, 170, 'pet_slime');

    // สปอว์นมอนสเตอร์ตัวแรก
    spawnEnemy.call(this);

    // UI แจ้งเตือนด้านบน
    topBanner = this.add.rectangle(260, -30, 340, 24, 0x000000, 0.85).setStrokeStyle(1, 0x555555);
    topBannerText = this.add.text(260, -30, '', { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5);

    // เกจวัดความคืบหน้าบอส
    this.add.rectangle(450, 205, 80, 8, 0x2d3436);
    stageProgressBar = this.add.rectangle(410, 205, 0, 6, 0xe74c3c).setOrigin(0, 0.5);
    this.add.text(495, 205, '👹', { fontSize: '10px' }).setOrigin(0.5);

    // Auto Attack Loop
    this.time.addEvent({
        delay: 1100,
        callback: performRangedAttack,
        callbackScope: this,
        loop: true
    });

    setupIncomingBridge.call(this);
}

// ==========================================
// 5. Update Loop ( Parallax Movement )
// ==========================================
function update() {
    // เลื่อนฉากหลังตามความเร็ว Parallax
    bgFar.tilePositionX += 0.1;
    bgMid.tilePositionX += 0.4;
    bgFloor.tilePositionX += 1.2;

    if (pet) {
        pet.y = 170 + Math.sin(this.time.now / 200) * 2;
    }
}

// ==========================================
// 6. Combat & Game Logic
// ==========================================
function spawnEnemy() {
    if (killsInStage >= maxKillsPerStage) {
        isBossFight = true;
        enemyHp = 300; maxEnemyHp = 300;
    } else {
        isBossFight = false;
        enemyHp = 100; maxEnemyHp = 100;
    }

    if (!enemy) {
        enemy = this.add.sprite(180, 165, 'enemy_normal');
        this.add.rectangle(180, 138, 42, 5, 0x000000);
        enemyHpBar = this.add.rectangle(180, 138, 40, 3, 0xe74c3c);
        enemyNameText = this.add.text(180, 126, '', { fontSize: '10px', color: '#fff' }).setOrigin(0.5);
    }

    if (isBossFight) {
        enemy.setTexture('enemy_boss');
        enemy.setPosition(180, 155);
        enemyNameText.setText("🔥 BOSS GIGANT").setColor("#f1c40f");
        showTopNotification.call(this, "⚠️️ WARNING! บอสประจำด่านปรากฏตัว!");
    } else {
        enemy.setTexture('enemy_normal');
        enemy.setPosition(180, 165);
        enemyNameText.setText("Slime Minion").setColor("#ffffff");
    }

    enemy.setVisible(true);
    enemy.setAlpha(1);
    updateEnemyHpBar();
}

function updateEnemyHpBar() {
    const pct = Math.max(0, enemyHp / maxEnemyHp);
    enemyHpBar.width = 40 * pct;
}

function performRangedAttack() {
    if (enemyHp <= 0 || !enemy.visible) return;

    const arrow = this.add.sprite(hero.x - 10, hero.y - 5, 'arrow_sprite');

    this.tweens.add({
        targets: arrow,
        x: enemy.x + 10,
        y: enemy.y,
        duration: 160,
        onComplete: () => {
            arrow.destroy();
            applyDamage.call(this);
        }
    });
}

function applyDamage() {
    const isCrit = Math.random() < 0.3;
    const damage = isCrit ? Math.floor(Math.random() * 25) + 35 : Math.floor(Math.random() * 10) + 15;

    enemyHp -= damage;
    updateEnemyHpBar();

    if (isCrit || isBossFight) {
        this.cameras.main.shake(120, isBossFight ? 0.008 : 0.004);
    }

    createImpactSparks.call(this, enemy.x, enemy.y);
    showDamageText.call(this, enemy.x, enemy.y - 20, damage, isCrit);

    if (enemyHp <= 0) {
        onEnemyKilled.call(this);
    }
}

function createImpactSparks(x, y) {
    for (let i = 0; i < 5; i++) {
        const spark = this.add.sprite(x, y, 'spark_particle');
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 25 + 10;

        this.tweens.add({
            targets: spark,
            x: x + Math.cos(angle) * speed,
            y: y + Math.sin(angle) * speed,
            alpha: 0,
            duration: 200,
            onComplete: () => spark.destroy()
        });
    }
}

function showDamageText(x, y, damage, isCrit) {
    const txt = this.add.text(x, y, isCrit ? `CRIT ${damage}` : `${damage}`, {
        fontSize: isCrit ? '16px' : '12px',
        fontStyle: 'bold',
        color: isCrit ? '#ff4757' : '#ffffff',
        stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);

    this.tweens.add({
        targets: txt,
        y: y - 25,
        alpha: 0,
        duration: 600,
        onComplete: () => txt.destroy()
    });
}

function onEnemyKilled() {
    enemy.setVisible(false);

    if (isBossFight) {
        // เคลียร์บอสสำเร็จ -> ขึ้นด่านใหม่
        triggerStageClearEffect.call(this);
    } else {
        killsInStage++;
        stageProgressBar.width = 80 * (killsInStage / maxKillsPerStage);

        // ดรอปของ
        spawnCoinBurst.call(this, enemy.x, enemy.y);
        showLootChestAnimation.call(this, enemy.x, enemy.y);

        // โอกาส 40% ดรอปอุปกรณ์
        if (Math.random() < 0.4) {
            spawnEquipmentDrop.call(this, enemy.x, enemy.y);
        }

        sendToFlutterFlow({
            event: 'MONSTER_DIED',
            stage: currentStage,
            goldReward: 15, expReward: 30
        });

        this.time.delayedCall(1000, () => spawnEnemy.call(this));
    }
}

function triggerStageClearEffect() {
    // เล่น Effect STAGE CLEAR
    const clearText = this.add.text(260, 110, '🎉 STAGE CLEAR! 🎉', {
        fontSize: '24px', fontStyle: 'bold', color: '#f1c40f',
        stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
        targets: clearText,
        scale: 1.2,
        duration: 400,
        yoyo: true, hold: 800,
        onComplete: () => {
            clearText.destroy();
            
            // อัปเดตเลขด่าน
            killsInStage = 0;
            stageProgressBar.width = 0;
            currentStage = "2-9";
            
            showTopNotification.call(this, "เข้าสู่ด่านใหม่: Stage 2-9");

            sendToFlutterFlow({
                event: 'STAGE_CLEARED',
                newStage: currentStage,
                bonusGold: 100
            });

            spawnEnemy.call(this);
        }
    });
}

function spawnEquipmentDrop(x, y) {
    const sword = this.add.sprite(x, y, 'item_sword');
    this.tweens.add({
        targets: sword,
        y: y - 20, x: x - 20,
        duration: 300, yoyo: true,
        onComplete: () => {
            this.tweens.add({
                targets: sword, alpha: 0, duration: 500,
                onComplete: () => sword.destroy()
            });
        }
    });

    sendToFlutterFlow({
        event: 'ITEM_DROPPED',
        itemName: 'Flame Sword +1',
        icon: '⚔️'
    });
}

function spawnCoinBurst(x, y) {
    for (let i = 0; i < 4; i++) {
        const coin = this.add.sprite(x, y, 'coin_sprite');
        this.tweens.add({
            targets: coin,
            x: x + (Math.random() - 0.5) * 30,
            y: y - 15, duration: 250, yoyo: true,
            onComplete: () => coin.destroy()
        });
    }
}

function showLootChestAnimation(x, y) {
    const chest = this.add.sprite(x, y - 10, 'chest_sprite');
    this.tweens.add({
        targets: chest, y: y - 35, alpha: 0, duration: 800,
        onComplete: () => chest.destroy()
    });
}

function showTopNotification(text) {
    topBannerText.setText(text);
    this.tweens.add({
        targets: [topBanner, topBannerText],
        y: 20, duration: 200, hold: 1200, yoyo: true
    });
}

// ==========================================
// 7. Incoming Bridge Functions (Control Panel Callbacks)
// ==========================================
function setupIncomingBridge() {
    const scene = this;

    window.changePetSkin = function(skinType) {
        if (!pet) return;
        if (skinType === 'dragon') pet.setTexture('pet_dragon');
        else if (skinType === 'phoenix') pet.setTexture('pet_phoenix');
        else pet.setTexture('pet_slime');
    };

    window.triggerHeroSkill = function(skillName) {
        scene.cameras.main.shake(250, 0.012);
        const beam = scene.add.rectangle(enemy.x, 110, 50, 220, 0xf1c40f, 0.8);
        scene.tweens.add({
            targets: beam, alpha: 0, duration: 400,
            onComplete: () => {
                beam.destroy();
                applyDamage.call(scene);
            }
        });
    };

    window.changeMapTheme = function(themeName) {
        currentTheme = themeName;
        if (themeName === 'dungeon') {
            bgFar.setTexture('bg_dungeon_far');
            bgMid.setTexture('bg_dungeon_mid');
            bgFloor.setTexture('bg_dungeon_floor');
        } else if (themeName === 'lava') {
            bgFar.setTexture('bg_lava_far');
            bgMid.setTexture('bg_lava_mid');
            bgFloor.setTexture('bg_lava_floor');
        } else {
            bgFar.setTexture('bg_forest_far');
            bgMid.setTexture('bg_forest_mid');
            bgFloor.setTexture('bg_forest_floor');
        }
    };

    window.forceSpawnBoss = function() {
        killsInStage = maxKillsPerStage;
        spawnEnemy.call(scene);
    };
}
