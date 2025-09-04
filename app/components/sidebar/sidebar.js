// Sidebar Component - 侧边栏组件
export class AppSidebar extends HTMLElement {
    constructor() {
        super();
        this.isOpen = true;
        this.attachShadow({ mode: 'open' });
        this.loadTemplate();
        this.setupLayoutIntegration();
    }

    async loadTemplate() {
        try {
            // 获取当前模块的基础路径
            const baseUrl = new URL('.', import.meta.url);
            
            // 加载 HTML 模板
            const htmlResponse = await fetch(new URL('./sidebar.html', baseUrl));
            const htmlContent = await htmlResponse.text();
            
            // 加载 CSS 样式
            const cssResponse = await fetch(new URL('./sidebar.css', baseUrl));
            const cssContent = await cssResponse.text();
            
            // 渲染组件
            this.shadowRoot.innerHTML = `
                <style>${cssContent}</style>
                ${htmlContent}
            `;
            
        } catch (error) {
            console.error('Failed to load sidebar template:', error);
            // 降级到内联模板
            this.renderFallback();
        }
    }
    
    renderFallback() {
        // 如果外部文件加载失败，使用内联模板作为降级方案
        this.shadowRoot.innerHTML = `
            <style>
                .app-sidebar {
                    position: fixed;
                    left: -300px;
                    top: 80px;
                    width: 300px;
                    height: calc(100vh - 80px);
                    background: #f8f9fa;
                    box-shadow: 2px 0 10px rgba(0,0,0,0.1);
                    transition: left 0.3s ease;
                    z-index: 999;
                }
                .app-sidebar.open {
                    left: 0;
                }
            </style>
            <aside class="app-sidebar">
                <div class="sidebar-content">
                    <p>侧边栏内容</p>
                </div>
            </aside>
        `;
    }
    
    toggle() {
        this.isOpen = !this.isOpen;
        this.classList.toggle('closed', !this.isOpen);
        
        // 同步状态到布局管理器
        if (window.layoutManager) {
            window.layoutManager.setSidebarState(this.isOpen);
        }
    }
    
    /**
     * 设置布局管理器集成
     */
    setupLayoutIntegration() {
        // 监听布局管理器的侧栏状态变化
        document.addEventListener('layout:sidebar:change', (e) => {
            this.updateState(e.detail.isOpen);
        });
        
        // 监听侧栏切换事件（降级方案）
        document.addEventListener('sidebar:toggle', () => {
            this.toggle();
        });
        
        // 监听断点变化
        document.addEventListener('layout:breakpoint:change', (e) => {
            this.handleBreakpointChange(e.detail);
        });
    }
    
    /**
     * 更新侧栏状态
     */
    updateState(isOpen) {
        if (this.isOpen !== isOpen) {
            this.isOpen = isOpen;
            this.classList.toggle('closed', !this.isOpen);
            
            // 更新shadow DOM中的样式
            const sidebar = this.shadowRoot.querySelector('.app-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('open', this.isOpen);
            }
        }
    }
    
    /**
     * 处理断点变化
     */
    handleBreakpointChange(detail) {
        // 在移动端自动关闭侧栏
        if (detail.newBreakpoint === 'xs' || detail.newBreakpoint === 'sm') {
            this.updateState(false);
        }
    }
    
    toggleCollapse(element) {
        const content = element.nextElementSibling;
        element.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
    }
}