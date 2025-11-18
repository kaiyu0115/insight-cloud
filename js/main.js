// 全域變數暫存
let globalData = {};

document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
});

async function initApp() {
    try {
        // 1. 加上時間戳記防止 JSON 被瀏覽器快取，確保 CMS 更新後能看到內容
        const response = await fetch(`data/content.json?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error("無法載入資料庫");
        
        globalData = await response.json();
        
        // 渲染各區塊
        renderConfig(globalData.config);
        renderArticles(globalData.articles);
        renderTopPosts(globalData.articles);
        renderDashboards(globalData.dashboards);
        renderTools(globalData.tools);
        
        // 初始化功能
        initFilters(globalData.articles);
        initSearch(globalData.articles);
        initCopyProtection();
        initCookieConsent();
        initD3Banner(); // 啟動 D3 動畫
        
    } catch (error) {
        console.error("Error:", error);
        document.getElementById('article-list').innerHTML = `<div class="error-msg">載入失敗，請檢查 data/content.json 格式</div>`;
    }
}

// --- 渲染邏輯 ---

function renderConfig(config) {
    if(!config) return;
    document.querySelector('.logo').innerHTML = `${config.siteName} <span class="dot">.</span>`;
    document.getElementById('hero-title').innerText = config.heroTitle;
    document.getElementById('hero-subtitle').innerText = config.heroSubtitle;
    document.getElementById('about-text').innerHTML = `<p>${config.aboutText}</p>`;
    document.getElementById('sponsor-link').href = config.sponsorLink;
    document.getElementById('current-year').innerText = new Date().getFullYear();
}

function renderArticles(articles) {
    const container = document.getElementById('article-list');
    container.innerHTML = '';

    if (articles.length === 0) {
        container.innerHTML = '<p>目前沒有文章。</p>';
        return;
    }

    articles.forEach(art => {
        // 簡單處理 Markdown 轉 HTML (CMS 存的是 Markdown，這裡做極簡轉換，實際可用 marked.js)
        // 這裡假設 CMS 的 Widget: Markdown 存入的是純文字或簡單 HTML，若有複雜格式建議引入 marked.js
        const summary = art.summary || art.content.substring(0, 100) + '...';
        
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
            <div class="meta">
                <span class="tag">${art.category}</span>
                <span class="date">${art.date}</span>
            </div>
            <h3>${art.title}</h3>
            <p>${summary}</p>
            <div class="stats">
                <span><i class="fas fa-eye"></i> ${art.views}</span>
                <span class="like-btn" onclick="toggleLike(this)"><i class="far fa-heart"></i></span>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderTopPosts(articles) {
    // 排序邏輯：置頂優先，其次按瀏覽數
    const sorted = [...articles].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.views - a.views;
    });

    const top3 = sorted.slice(0, 3);
    const container = document.getElementById('top-posts-container');
    container.innerHTML = top3.map(art => `
        <div class="card" style="border-left: 4px solid var(--accent)">
            <h4><i class="fas fa-crown" style="color:#fbbf24; margin-right:5px;"></i> ${art.title}</h4>
            <p style="font-size:0.9rem; margin-bottom:0.5rem;">${art.summary.substring(0, 40)}...</p>
            <div class="meta" style="margin-bottom:0;">
                <small><i class="fas fa-fire"></i> ${art.views} 熱度</small>
            </div>
        </div>
    `).join('');
}

function renderDashboards(dashboards) {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = dashboards.map(d => `
        <div class="dashboard-card">
            <h3>${d.title}</h3>
            <p style="font-size: 0.9rem; color: #cbd5e1;">${d.description}</p>
            <div class="viz-container">
                <img src="${d.image || 'assets/images/placeholder.png'}" alt="${d.title}" style="opacity:0.5; max-height:100%;">
                <a href="${d.link}" class="viz-overlay">
                    <button class="btn primary">查看互動圖表</button>
                </a>
            </div>
        </div>
    `).join('');
}

function renderTools(tools) {
    const container = document.getElementById('tools-container');
    container.innerHTML = tools.map(t => `
        <a href="${t.link}" class="tool-card">
            <div class="tool-icon"><i class="fas ${t.icon}"></i></div>
            <h4>${t.name}</h4>
            <p style="font-size:0.85rem; color:var(--text-light);">${t.description}</p>
        </a>
    `).join('');
}

// --- 互動功能 ---

function initFilters(articles) {
    const container = document.getElementById('category-filters');
    // 取得不重複分類
    const categories = [...new Set(articles.map(a => a.category))];
    
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.innerText = cat;
        btn.dataset.filter = cat;
        btn.addEventListener('click', () => filterArticles(cat, btn));
        container.appendChild(btn);
    });

    document.querySelector('[data-filter="all"]').addEventListener('click', (e) => filterArticles('all', e.target));
}

function filterArticles(category, btnElement) {
    // UI 更新
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    if (category === 'all') {
        renderArticles(globalData.articles);
    } else {
        const filtered = globalData.articles.filter(a => a.category === category);
        renderArticles(filtered);
    }
}

function initSearch(articles) {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');

    const performSearch = () => {
        const term = input.value.toLowerCase();
        const filtered = articles.filter(a => 
            a.title.toLowerCase().includes(term) || 
            (a.summary && a.summary.toLowerCase().includes(term))
        );
        renderArticles(filtered);
        // 如果有搜尋結果，滾動到文章區
        document.getElementById('articles').scrollIntoView({behavior: 'smooth'});
    };

    input.addEventListener('keyup', (e) => {
        if(e.key === 'Enter') performSearch();
    });
    btn.addEventListener('click', performSearch);
}

// --- 實用功能：防複製與 Cookie ---

function initCopyProtection() {
    const modal = document.getElementById('copy-modal');
    const closeModal = document.querySelector('.close-modal');
    const citationText = document.getElementById('citation-text');
    const copyBtn = document.getElementById('copy-citation-btn');

    // 監聽複製行為
    document.addEventListener('copy', (e) => {
        const selection = document.getSelection().toString();
        // 只有當複製內容超過 30 字才觸發
        if (selection.length > 30) {
            // 顯示 Modal
            modal.classList.remove('hidden');
            
            // 設定引用連結
            const url = window.location.href;
            const text = `"${selection.substring(0, 20)}..." \n本文出自：${url} \n著作權所有，轉載請聯繫作者。`;
            citationText.innerText = text;
            
            // 自動修改剪貼簿內容 (部分瀏覽器允許)
            e.clipboardData.setData('text/plain', selection + `\n\n[來源: ${url}]`);
            e.preventDefault();
        }
    });

    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(citationText.innerText).then(() => {
            copyBtn.innerText = "已複製！";
            setTimeout(() => copyBtn.innerText = "複製引用來源", 2000);
        });
    });
}

function initCookieConsent() {
    const banner = document.getElementById('cookie-banner');
    const btn = document.getElementById('accept-cookie');
    
    if (!localStorage.getItem('cookie_accepted')) {
        banner.classList.remove('hidden');
    }

    btn.addEventListener('click', () => {
        localStorage.setItem('cookie_accepted', 'true');
        banner.classList.add('hidden');
    });
}

// --- D3.js 視覺化 (背景動畫) ---

function initD3Banner() {
    const container = document.getElementById('hero-viz');
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // 清除舊的（如果 resize）
    d3.select("#hero-viz").selectAll("*").remove();

    const svg = d3.select("#hero-viz")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`);

    // 創建數據節點
    const nodes = d3.range(30).map(() => ({
        r: Math.random() * 10 + 2,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2
    }));

    const circles = svg.selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", d => d.r)
        .attr("fill", "#06b6d4")
        .attr("opacity", 0.3);

    const lines = svg.selectAll("line")
        .data(nodes) // 這裡簡化，只做點的動畫，連線邏輯較複雜省略以保持效能
        .enter(); 

    // 動畫迴圈
    const timer = d3.timer(() => {
        nodes.forEach(d => {
            d.x += d.vx;
            d.y += d.vy;

            // 邊界反彈
            if (d.x < 0 || d.x > width) d.vx *= -1;
            if (d.y < 0 || d.y > height) d.vy *= -1;
        });

        circles
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    });
}

function toggleLike(btn) {
    const icon = btn.querySelector('i');
    if (icon.classList.contains('far')) {
        icon.classList.replace('far', 'fas');
        icon.style.color = '#e25822';
        // 這裡可以加上發送 API 到後端紀錄按讚的邏輯
    } else {
        icon.classList.replace('fas', 'far');
        icon.style.color = '';
    }
}