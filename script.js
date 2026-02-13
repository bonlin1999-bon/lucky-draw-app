// === Firebase 設定 ===
const firebaseConfig = {
    apiKey: "AIzaSyDeL-fLLNCmBD03UmTWr3NW_xgOjhu_tZE",
    authDomain: "lucky-draw-98946.firebaseapp.com",
    databaseURL: "https://lucky-draw-98946-default-rtdb.firebaseio.com",
    projectId: "lucky-draw-98946",
    storageBucket: "lucky-draw-98946.firebasestorage.app",
    messagingSenderId: "570514263042",
    appId: "1:570514263042:web:98b2e9fe8e1393448a2b1b"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 資料庫參考路徑
const roomRef = db.ref('room');
const configRef = roomRef.child('config');
const stateRef = roomRef.child('state');
const winnersRef = roomRef.child('winners');
const presenceRef = db.ref('.info/connected');
const onlineRef = db.ref('online');

// --- Confetti System ---
class ConfettiSystem {
    constructor() {
        this.canvas = document.getElementById('confetti-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.isActive = false;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start() {
        this.isActive = true;
        this.particles = [];
        for (let i = 0; i < 150; i++) {
            this.particles.push(this.createParticle());
        }
        this.animate();
    }

    createParticle() {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ffd700'];
        return {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20 - 5,
            gravity: 0.2,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 10 + 5,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            opacity: 1
        };
    }

    animate() {
        if (!this.isActive) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach((p, index) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.rotation += p.rotationSpeed;
            p.opacity -= 0.005;

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.globalAlpha = p.opacity;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();

            if (p.opacity <= 0) {
                this.particles.splice(index, 1);
            }
        });

        if (this.particles.length > 0) {
            requestAnimationFrame(() => this.animate());
        } else {
            this.isActive = false;
        }
    }
}

// --- 3D Reel System ---
class Reel3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.slotCount = 12;
        this.radius = 290;
        this.currentRotation = 0;
    }

    createCylinder(pool, winner) {
        this.container.innerHTML = '';
        let slots = [];
        const winnerIndex = Math.floor(Math.random() * this.slotCount);
        for (let i = 0; i < this.slotCount; i++) {
            if (i === winnerIndex) {
                slots.push(winner);
            } else {
                slots.push(pool[Math.floor(Math.random() * pool.length)]);
            }
        }
        const anglePerSlot = 360 / this.slotCount;
        slots.forEach((name, i) => {
            const el = document.createElement('div');
            el.className = 'reel-item';
            el.textContent = name;
            el.style.transform = `rotateX(${i * anglePerSlot}deg) translateZ(${this.radius}px)`;
            this.container.appendChild(el);
        });
        return { slots, anglePerSlot, winnerIndex };
    }

    async spin(pool, winner) {
        const { anglePerSlot, winnerIndex } = this.createCylinder(pool, winner);
        const rounds = 5 + Math.floor(Math.random() * 5);
        const targetRotation = -(rounds * 360) - (winnerIndex * anglePerSlot);

        this.container.style.transition = 'none';
        this.container.style.transform = `rotateX(0deg)`;
        this.container.offsetHeight;

        this.container.classList.add('blur-motion');
        const duration = 2.5 + Math.random();
        this.container.style.transition = `transform ${duration}s cubic-bezier(0.1, 0, 0.2, 1)`;
        this.container.style.transform = `rotateX(${targetRotation}deg)`;

        return new Promise(resolve => {
            setTimeout(() => {
                this.container.classList.remove('blur-motion');
                const items = this.container.querySelectorAll('.reel-item');
                items[winnerIndex].classList.add('current');
                resolve();
            }, duration * 1000);
        });
    }

    // 直接顯示結果（無動畫）
    showInstant(winner) {
        this.container.innerHTML = `<div class="reel-item current">${winner}</div>`;
        this.container.style.transform = 'none';
        this.container.style.transition = 'none';
    }
}

// === 主應用程式 ===
class LuckyDraw {
    constructor() {
        this.role = null; // 'host' 或 'viewer'
        this.winners = [];
        this.isRolling = false;
        this.allNames = []; // 從 Firebase 同步的名單

        // DOM 元素
        this.namesInput = document.getElementById('names-input');
        this.prizeInput = document.getElementById('prize-name');
        this.countInput = document.getElementById('draw-count');
        this.startBtn = document.getElementById('start-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.winnersList = document.getElementById('winners-list');
        this.drawBtn = document.getElementById('draw-action-btn');
        this.configPanel = document.getElementById('config-panel');
        this.controlContainer = document.getElementById('control-container');

        // Batch 元素
        this.batchOverlay = document.getElementById('batch-overlay');
        this.batchGrid = document.getElementById('batch-grid');
        this.batchCloseBtn = document.getElementById('batch-close-btn');

        // 系統
        this.reel = new Reel3D('reel-container');
        this.confetti = new ConfettiSystem();

        this.initRoleSelect();
        this.initFirebaseListeners();
    }

    // === 角色選擇 ===
    initRoleSelect() {
        document.getElementById('role-host-btn').addEventListener('click', () => {
            this.setRole('host');
        });
        document.getElementById('role-viewer-btn').addEventListener('click', () => {
            this.setRole('viewer');
        });
    }

    setRole(role) {
        this.role = role;
        // 隱藏角色選擇畫面
        document.getElementById('role-select').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';

        if (role === 'viewer') {
            // 觀眾模式：隱藏設定面板和 GO 按鈕
            this.configPanel.style.display = 'none';
            this.controlContainer.style.display = 'none';
        } else {
            // 主持人模式：初始化控制功能
            this.initHostControls();
        }
    }

    // === 主持人控制 ===
    initHostControls() {
        this.startBtn.addEventListener('click', () => this.startDraw());
        this.resetBtn.addEventListener('click', () => this.reset());
        document.getElementById('import-1-80-btn').addEventListener('click', () => this.importNumbers(1, 80));
        this.batchCloseBtn.addEventListener('click', () => this.closeBatchOverlay());

        this.drawBtn.addEventListener('click', () => {
            if (!this.isRolling && !this.startBtn.disabled) {
                this.animateButtonAndDraw();
            }
        });

        this.namesInput.placeholder = "請輸入參與者名單... 或使用匯入按鈕";

        // 主持人啟動時直接匯入 1~80 號
        const numbers = [];
        for (let i = 1; i <= 80; i++) {
            numbers.push(i);
        }
        this.namesInput.value = numbers.join('\n');
        configRef.update({ names: this.namesInput.value });

        // 主持人名單變更時，同步到 Firebase
        this.namesInput.addEventListener('input', () => {
            configRef.update({ names: this.namesInput.value });
        });
        this.prizeInput.addEventListener('input', () => {
            configRef.update({ prizeName: this.prizeInput.value });
        });
    }

    // === Firebase 即時監聽 ===
    initFirebaseListeners() {
        // 監聽連線狀態
        presenceRef.on('value', (snap) => {
            const status = document.getElementById('connection-status');
            if (snap.val() === true) {
                status.innerHTML = '✅ 已連線到伺服器';
                status.style.color = '#00ff88';
                // 註冊在線使用者
                const userRef = onlineRef.push();
                userRef.onDisconnect().remove();
                userRef.set(true);
            } else {
                status.innerHTML = '❌ 連線中斷';
                status.style.color = '#ff4444';
            }
        });

        // 監聽在線人數
        onlineRef.on('value', (snap) => {
            const count = snap.numChildren();
            const el = document.getElementById('online-count');
            if (el) el.textContent = `👥 線上人數：${count}`;
        });

        // 監聽中獎名單變化（所有角色都要監聽）
        winnersRef.on('value', (snap) => {
            const data = snap.val();
            this.winnersList.innerHTML = '';
            this.winners = [];
            if (data) {
                // 將物件轉為陣列並按時間排序
                const winnerList = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
                winnerList.forEach(w => {
                    this.winners.push(w.name);
                    this.addWinnerCard(w.name, w.prize);
                });
            }
        });

        // 監聽抽獎狀態變化（觀眾用來同步動畫）
        stateRef.on('value', async (snap) => {
            const state = snap.val();
            if (!state) return;

            // 只有觀眾才需要被動接收結果
            if (this.role === 'viewer') {
                if (state.phase === 'spinning') {
                    // 顯示轉盤動畫
                    const pool = state.pool || ['?'];
                    const winner = state.currentWinner;
                    if (state.animationEnabled) {
                        await this.reel.spin(pool, winner);
                    } else {
                        this.reel.showInstant(winner);
                    }
                    this.confetti.start();
                } else if (state.phase === 'batch') {
                    // 批量模式：顯示 overlay
                    this.showBatchResult(state.batchWinners || [], state.prizeName || '');
                } else if (state.phase === 'idle') {
                    // 閒置狀態
                }
            }
        });
    }

    // === 取得可用名單（排除已中獎者）===
    getNames() {
        return this.namesInput.value
            .split('\n')
            .map(name => name.trim())
            .filter(name => name !== '' && !this.winners.includes(name));
    }

    // === 使用 Firebase Transaction 原子操作抽獎（防止同時抽獎重複）===
    async drawWithTransaction(prizeName) {
        // 透過 transaction 確保「讀取可用名單 → 隨機選人 → 寫入中獎」是不可分割的原子操作
        const allNames = this.namesInput.value
            .split('\n')
            .map(n => n.trim())
            .filter(n => n !== '');

        const result = await winnersRef.transaction((currentWinners) => {
            // currentWinners 是目前 Firebase 上的中獎資料（可能為 null）
            const winnersMap = currentWinners || {};
            const existingNames = Object.values(winnersMap).map(w => w.name);

            // 計算真正可用的名單
            const available = allNames.filter(name => !existingNames.includes(name));

            if (available.length === 0) {
                // 沒有可抽的人，中止 transaction（回傳 undefined）
                return;
            }

            // 隨機選出一位中獎者
            const winner = available[Math.floor(Math.random() * available.length)];

            // 產生唯一 key 並新增到中獎資料中
            const newKey = db.ref().push().key;
            winnersMap[newKey] = {
                name: winner,
                prize: prizeName,
                timestamp: Date.now()
            };

            return winnersMap;
        });

        if (result.committed) {
            // Transaction 成功，找出剛才新增的中獎者
            const data = result.snapshot.val();
            if (!data) return null;
            const entries = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
            return entries[0]?.name || null;
        }

        return null; // Transaction 被中止（名單已空）
    }

    // === 按鈕動畫 ===
    async animateButtonAndDraw() {
        this.drawBtn.classList.add('pressed');
        setTimeout(() => this.drawBtn.classList.remove('pressed'), 200);
        await new Promise(r => setTimeout(r, 100));
        this.startDraw();
    }

    // === 開始抽獎（僅主持人）===
    async startDraw() {
        if (this.isRolling) return;

        const currentNames = this.getNames();
        const count = parseInt(this.countInput.value) || 1;

        if (currentNames.length === 0) {
            alert('名單已抽完或名單為空！');
            return;
        }

        this.isRolling = true;
        this.startBtn.disabled = true;
        this.drawBtn.style.cursor = 'not-allowed';
        this.drawBtn.style.opacity = '0.7';

        const animationEnabled = document.getElementById('animation-toggle').checked;

        if (count >= 10) {
            await this.runBatchDraw(count, currentNames, animationEnabled);
        } else {
            await this.runReelDraw(count, animationEnabled);
        }

        // 恢復按鈕狀態
        this.isRolling = false;
        this.startBtn.disabled = false;
        this.drawBtn.style.cursor = 'pointer';
        this.drawBtn.style.opacity = '1';

        // 設定狀態為閒置
        stateRef.set({ phase: 'idle' });
    }

    // === 轉盤抽獎模式（使用 Transaction 防重複）===
    async runReelDraw(count, animationEnabled) {
        const prizeName = this.prizeInput.value;

        for (let i = 0; i < count; i++) {
            const pool = this.getNames();
            if (pool.length === 0) break;

            // 使用 Transaction 原子操作選出中獎者
            const winner = await this.drawWithTransaction(prizeName);
            if (!winner) {
                alert('名單已抽完！');
                break;
            }

            // 通知觀眾開始轉盤
            await stateRef.set({
                phase: 'spinning',
                currentWinner: winner,
                pool: pool.slice(0, 12),
                animationEnabled: animationEnabled,
                timestamp: Date.now()
            });

            // 主持人自己也播放動畫
            if (animationEnabled) {
                await this.reel.spin(pool, winner);
            } else {
                this.reel.showInstant(winner);
                if (count > 1) await new Promise(r => setTimeout(r, 500));
            }

            this.confetti.start();

            if (i < count - 1 && animationEnabled) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    // === 批量抽獎模式（使用 Transaction 防重複）===
    async runBatchDraw(count, currentNames, animationEnabled) {
        this.batchOverlay.classList.remove('hidden');
        this.batchGrid.innerHTML = '';
        this.batchCloseBtn.classList.add('hidden');
        await new Promise(r => setTimeout(r, 500));

        let drawnCount = 0;
        const prizeName = this.prizeInput.value;
        const batchWinners = [];

        while (drawnCount < count) {
            // 使用 Transaction 原子操作選出中獎者
            const winner = await this.drawWithTransaction(prizeName);
            if (!winner) break; // 名單已空

            batchWinners.push({ name: winner, prize: prizeName });

            // 主持人畫面顯示卡片
            const card = document.createElement('div');
            card.className = 'batch-card';
            card.innerHTML = `<div class="prize">${prizeName}</div><div>${winner}</div>`;
            this.batchGrid.appendChild(card);
            this.batchGrid.scrollTop = this.batchGrid.scrollHeight;

            drawnCount++;

            const delay = animationEnabled ? 200 : 50;
            await new Promise(r => setTimeout(r, delay));
        }

        // 通知觀眾顯示批量結果
        await stateRef.set({
            phase: 'batch',
            batchWinners: batchWinners,
            prizeName: prizeName,
            timestamp: Date.now()
        });

        this.confetti.start();
        this.batchCloseBtn.classList.remove('hidden');

        await new Promise(resolve => {
            this.resolveBatch = resolve;
        });
    }

    // === 觀眾看到的批量結果 ===
    showBatchResult(batchWinners, prizeName) {
        this.batchOverlay.classList.remove('hidden');
        this.batchGrid.innerHTML = '';
        this.batchCloseBtn.classList.add('hidden');

        batchWinners.forEach((w, i) => {
            setTimeout(() => {
                const card = document.createElement('div');
                card.className = 'batch-card';
                card.innerHTML = `<div class="prize">${w.prize || prizeName}</div><div>${w.name}</div>`;
                this.batchGrid.appendChild(card);
            }, i * 100);
        });

        this.confetti.start();

        // 觀眾的關閉按鈕
        setTimeout(() => {
            this.batchCloseBtn.classList.remove('hidden');
            this.batchCloseBtn.onclick = () => {
                this.batchOverlay.classList.add('hidden');
            };
        }, batchWinners.length * 100 + 500);
    }

    closeBatchOverlay() {
        this.batchOverlay.classList.add('hidden');
        if (this.resolveBatch) {
            this.resolveBatch();
            this.resolveBatch = null;
        }
    }

    addWinnerCard(name, prize) {
        const card = document.createElement('div');
        card.className = 'winner-card';
        card.innerHTML = `
            <div class="prize-type" style="font-size: 0.7rem; color: var(--text-dim)">${prize || ''}</div>
            <div class="name">${name}</div>
        `;
        this.winnersList.prepend(card);
    }

    // === 重設（僅主持人）===
    reset() {
        if (confirm('確定要重置所有中獎記錄嗎？')) {
            // 清除 Firebase 資料
            winnersRef.remove();
            stateRef.set({ phase: 'idle' });
            document.getElementById('reel-container').innerHTML = '<div class="reel-item current">READY?</div>';
            document.getElementById('reel-container').style.transform = 'none';
        }
    }

    // === 匯入數字 ===
    importNumbers(start, end) {
        if (confirm(`確定要匯入 ${start} 到 ${end} 的號碼嗎？這將會覆蓋目前的名單。`)) {
            const numbers = [];
            for (let i = start; i <= end; i++) {
                numbers.push(i);
            }
            this.namesInput.value = numbers.join('\n');
            // 同步到 Firebase
            configRef.update({ names: this.namesInput.value });
            alert(`已匯入 ${start} 到 ${end} 號！`);
        }
    }
}

// === 啟動 ===
document.addEventListener('DOMContentLoaded', () => {
    new LuckyDraw();
});
