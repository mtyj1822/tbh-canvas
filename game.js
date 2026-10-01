// ==========================================
// 1. JS Bridge: ส่งข้อมูลกลับหา FlutterFlow
// ==========================================
function sendToFlutterFlow(payload) {
    const jsonString = JSON.stringify(payload);
    if (window.FlutterChannel && window.FlutterChannel.postMessage) {
        window.FlutterChannel.postMessage(jsonString);
        console.log("--> [Sent to FlutterFlow]:", jsonString);
    } else {
        console.log("--> [Test Mode (No FlutterFlow)]:", jsonString);
    }
}

// ==========================================
// 2. Phaser 3 Configuration
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

// ตัวแปรสถานะภายในเกม
let hero, pet, enemy, portal;
let enemyHp = 100, maxEnemyHp = 100;
let enemyHpBar, topBanner, topBannerText, stageProgressBar;
let currentStage = "2-8";
let killsInStage = 0;
const maxKillsPerStage = 5;

// ==========================================
// 3. Preload & Asset Generation
// ==========================================
function preload() {
    let g = this.add.graphics();

    // ฮีโร่ (พิกเซลสีทอง/เขียว)
    g.fillStyle(0xf1c40f); g.fillRect(4, 0, 16, 24);
    g.fillStyle(0x2ecc71); g.fillRect(0, 8, 24, 16);
    g.generateTexture('hero_sprite', 24, 24); g.clear();

    // สัตว์เลี้ยงแบบต่างๆ (สำหรับเปลี่ยนสกินจาก FlutterFlow)
    // สกิน 1: Slime สีกุมภาพันธ์
    g.fillStyle(0x3498db); g.fillRect(2, 4, 12, 12);
    g.generateTexture('pet_slime', 16, 16); g.clear();
    // สกิน 2: Dragon สีแดง
    g.fillStyle(0xe74c3c); g.fillRect(0, 0, 16, 16);
    g.fillStyle(0xf1c40f); g.fillRect(4, 4, 4, 4);
    g.generateTexture('pet_dragon', 16, 16); g.clear();

    // ศัตรู
    g.fillStyle(0xdcdde1); g.fillRect(2, 2, 20, 22);
    g.fillStyle(0xe74c3c); g.fillRect(6, 6, 4, 4); g.fillRect(14, 6, 4, 4);
    g.generateTexture('enemy_sprite', 24, 24); g.clear();

    // โปรเจกไทล์ (ลูกธนู)
    g.fillStyle(0xf39c12); g.fillRect(0, 2, 12, 2);
    g.fillStyle(0xe74c3c); g.fillRect(10, 1, 3, 4);
    g.generateTexture('arrow_sprite', 14, 6); g.clear();

    // หีบสมบัติ
    g.fillStyle(0x8e44ad); g.fillRect(0, 0, 18, 16);
    g.fillStyle(0xf1c40f); g.fillRect(2, 2, 14, 12);
    g.generateTexture('chest_sprite', 18, 16); g.clear();

    // เหรียญทองพิกเซล
    g.fillStyle(0xf1c40f); g.fillCircle(4, 4, 4);
    g.generateTexture('coin_sprite', 8, 8); g.clear();

    // ประตูมิติ
    g.fillStyle(0x0984e3); g.fillCircle(12, 12, 12);
    g.fillStyle(0x74b9ff); g.fillCircle(12, 12, 6);
    g.generateTexture('portal_sprite', 24, 24); g.clear();

    // เอฟเฟกต์ประกายแสง (Spark Particle)
    g.fillStyle(0xffffff); g.fillRect(0, 0, 3, 3);
    g.generateTexture('spark_particle', 3, 3); g.clear();
}

// ==========================================
// 4. Create Scene Lifecycle
// ==========================================
function create() {
    this.add.rectangle(260, 110, 520, 220, 0x1e1e24);
    this.add.rectangle(260, 185, 520, 4, 0x3a3a48);

    const magicCircle = this.add.ellipse(390, 180, 50, 14);
    magicCircle.setStrokeStyle(2, 0xe67e22);

    portal = this.add.sprite(50, 160, 'portal_sprite');
    this.add.text(50, 130, currentStage, { fontSize: '11px', backgroundColor: '#00000088', padding: { x: 4, y: 2 } }).setOrigin(0.5);

    hero = this.add.sprite(390, 165, 'hero_sprite');
    pet = this.add.sprite(430, 170, 'pet_slime');

    spawnEnemy.call(this);

    // UI แจ้งเตือนด้านบน
    topBanner = this.add.rectangle(260, -30, 320, 24, 0x000000, 0.85).setStrokeStyle(1, 0x555555);
    topBannerText = this.add.text(260, -30, '', { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5);

    // เกจวัดความคืบหน้าบอส
    this.add.rectangle(450, 205, 80, 8, 0x2d3436);
    stageProgressBar = this.add.rectangle(410, 205, 0, 6, 0xe74c3c).setOrigin(0, 0.5);
    this.add.text(495, 205, '👹', { fontSize: '10px' }).setOrigin(0.5);

    // Auto Attack Loop
    this.time.addEvent({
        delay: 1200,
        callback: performRangedAttack,
        callbackScope: this,
        loop: true
    });

    // ⚠️ ลงทะเบียนรับคำสั่งภายนอกจาก FlutterFlow
    setupFlutterFlowListeners.call(this);
}

function update() {
    if (pet) {
        pet.y = 170 + Math.sin(this.time.now / 200) * 2;
    }
}

// ==========================================
// 5. Combat Functions & FX Polish
// ==========================================

function spawnEnemy() {
    enemyHp = 100;
    if (!enemy) {
        enemy = this.add.sprite(180, 165, 'enemy_sprite');
        this.add.rectangle(180, 146, 32, 5, 0x000000);
        enemyHpBar = this.add.rectangle(180, 146, 30, 3, 0xe74c3c);
    }
    enemy.setPosition(180, 165);
    enemy.setVisible(true);
    enemy.setAlpha(1);
    updateEnemyHpBar();
}

function updateEnemyHpBar() {
    const pct = Math.max(0, enemyHp / maxEnemyHp);
    enemyHpBar.width = 30 * pct;
}

function performRangedAttack() {
    if (enemyHp <= 0 || !enemy.visible) return;

    const arrow = this.add.sprite(hero.x - 10, hero.y - 5, 'arrow_sprite');

    this.tweens.add({
        targets: arrow,
        x: enemy.x + 10,
        y: enemy.y,
        duration: 180,
        onComplete: () => {
            arrow.destroy();
            applyDamage.call(this);
        }
    });
}

function applyDamage() {
    const isCrit = Math.random() < 0.3;
    const damage = isCrit ? Math.floor(Math.random() * 20) + 35 : Math.floor(Math.random() * 10) + 15;

    enemyHp -= damage;
    updateEnemyHpBar();

    // 1. เพิ่มเอฟเฟกต์จอสั่น (Screen Shake) เมื่อติด Critical
    if (isCrit) {
        this.cameras.main.shake(100, 0.005);
    }

    // 2. เอฟเฟกต์ประกายแสงการปะทะ (Impact Spark Particles)
    createImpactSparks.call(this, enemy.x, enemy.y);

    this.tweens.add({ targets: enemy, alpha: 0.3, duration: 50, yoyo: true });
    showDamageText.call(this, enemy.x, enemy.y - 15, damage, isCrit);

    if (enemyHp <= 0) {
        onEnemyKilled.call(this);
    }
}

function createImpactSparks(x, y) {
    for (let i = 0; i < 6; i++) {
        const spark = this.add.sprite(x, y, 'spark_particle');
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 30 + 10;

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
        fontSize: isCrit ? '15px' : '12px',
        fontStyle: 'bold',
        color: isCrit ? '#ff4757' : '#ffffff',
        stroke: '#000000',
        strokeThickness: 2
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
    killsInStage++;

    const progressPct = Math.min(1, killsInStage / maxKillsPerStage);
    stageProgressBar.width = 80 * progressPct;

    // 1. เอฟเฟกต์เหรียญทองกระจายลอยขึ้น (Coin Drops)
    spawnCoinBurst.call(this, enemy.x, enemy.y);

    // 2. แสดงหีบสมบัติ
    showLootChestAnimation.call(this, enemy.x, enemy.y);

    showTopNotification.call(this, "ได้รับ หีบสมบัติธรรมดา (โฮมุนครูลุส)");

    sendToFlutterFlow({
        event: 'MONSTER_DIED',
        stage: currentStage,
        itemDrop: 'Normal Chest (Homunculus)',
        goldReward: Math.floor(Math.random() * 15) + 10,
        expReward: 30
    });

    this.time.delayedCall(1000, () => {
        if (killsInStage >= maxKillsPerStage) {
            killsInStage = 0;
            stageProgressBar.width = 0;
        }
        spawnEnemy.call(this);
    });
}

function spawnCoinBurst(x, y) {
    for (let i = 0; i < 4; i++) {
        const coin = this.add.sprite(x, y, 'coin_sprite');
        const targetX = x + (Math.random() - 0.5) * 40;
        const targetY = y - Math.random() * 20 - 10;

        this.tweens.add({
            targets: coin,
            x: targetX,
            y: targetY,
            duration: 300,
            ease: 'Cubic.out',
            onComplete: () => {
                this.tweens.add({
                    targets: coin,
                    y: targetY + 15,
                    alpha: 0,
                    duration: 400,
                    onComplete: () => coin.destroy()
                });
            }
        });
    }
}

function showLootChestAnimation(x, y) {
    const chest = this.add.sprite(x, y - 10, 'chest_sprite');
    this.tweens.add({
        targets: chest,
        y: y - 40,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.out',
        onComplete: () => chest.destroy()
    });
}

function showTopNotification(text) {
    topBannerText.setText(text);
    this.tweens.add({
        targets: [topBanner, topBannerText],
        y: 20,
        duration: 250,
        hold: 1200,
        yoyo: true,
        ease: 'Back.out'
    });
}

// ==========================================
// 6. Incoming JS Bridge ( FlutterFlow -> Canvas )
// ==========================================
function setupFlutterFlowListeners() {
    const scene = this;

    // สั่งเปลี่ยนสกินสัตว์เลี้ยงจาก FlutterFlow
    window.changePetSkin = function(skinType) {
        if (pet) {
            if (skinType === 'dragon') {
                pet.setTexture('pet_dragon');
            } else {
                pet.setTexture('pet_slime');
            }
            console.log(`[Canvas] Pet skin updated to: ${skinType}`);
        }
    };

    // สั่งยิงสกิลใหญ่ (เช่น ฝนธนู / ท่าไม้ตาย)
    window.triggerHeroSkill = function(skillName) {
        console.log(`[Canvas] Executing skill: ${skillName}`);
        scene.cameras.main.shake(200, 0.01);
        
        // ร่ายเอฟเฟกต์ลำแสงถล่มศัตรู
        const beam = scene.add.rectangle(enemy.x, 90, 40, 180, 0xf1c40f, 0.8);
        scene.tweens.add({
            targets: beam,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                beam.destroy();
                applyDamage.call(scene);
            }
        });
    };
}