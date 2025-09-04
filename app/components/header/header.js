// Header Component - 头部导航组件
export class AppHeader extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.loadTemplate();
    }

    async loadTemplate() {
        try {
            // 获取当前模块的基础路径
            const baseUrl = new URL('.', import.meta.url);
            
            // 加载 HTML 模板
            const htmlResponse = await fetch(new URL('./header.html', baseUrl));
            const htmlContent = await htmlResponse.text();
            
            // 加载 CSS 样式
            const cssResponse = await fetch(new URL('./header.css', baseUrl));
            const cssContent = await cssResponse.text();
            
            // 渲染组件
            this.shadowRoot.innerHTML = `
                <style>${cssContent}</style>
                ${htmlContent}
            `;
            
            // 设置事件监听器
            this.setupEventListeners();
        } catch (error) {
            console.error('Failed to load header template:', error);
            // 降级到内联模板
            this.renderFallback();
        }
    }
    
    renderFallback() {
        this.shadowRoot.innerHTML = `
            <style>
                .app-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 1rem 0;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 1000;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .header-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .site-title {
                    font-size: 1.5rem;
                    font-weight: bold;
                    margin: 0;
                }
                .menu-toggle {
                    display: flex;
                    flex-direction: column;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0.5rem;
                    gap: 0.25rem;
                }
                .hamburger {
                    width: 25px;
                    height: 3px;
                    background-color: white;
                    transition: all 0.3s ease;
                }
            </style>
            <header class="app-header">
                <div class="header-content">
                    <button class="menu-toggle" id="menuToggle">
                        <span class="hamburger"></span>
                        <span class="hamburger"></span>
                        <span class="hamburger"></span>
                    </button>
                    <h1 class="site-title">我的个人网站</h1>
                </div>
            </header>
        `;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 设置事件监听器的方法
        const menuToggle = this.shadowRoot.querySelector('.menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => this.toggleSidebar());
        }
    }
    
    toggleSidebar() {
        // 使用布局管理器来切换侧栏状态
        if (window.layoutManager) {
            window.layoutManager.toggleSidebar();
        } else {
            // 降级方案：直接触发侧栏切换事件
            document.dispatchEvent(new CustomEvent('sidebar:toggle'));
        }
    }
}