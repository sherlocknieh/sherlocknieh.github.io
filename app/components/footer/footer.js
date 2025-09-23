// Footer Component - 页脚组件
export class AppFooter extends HTMLElement {
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
            const htmlResponse = await fetch(new URL('./footer.html', baseUrl));
            const htmlContent = await htmlResponse.text();
            
            // 加载 CSS 样式
            const cssResponse = await fetch(new URL('./footer.css', baseUrl));
            const cssContent = await cssResponse.text();
            
            // 渲染组件
            this.shadowRoot.innerHTML = `
                <style>${cssContent}</style>
                ${htmlContent}
            `;
            
            // 设置当前年份
            const yearElement = this.shadowRoot.getElementById('current-year');
            if (yearElement) {
                yearElement.textContent = new Date().getFullYear();
            }
            
        } catch (error) {
            console.error('Failed to load footer template:', error);
            // 降级到内联模板
            this.renderFallback();
        }
    }
    
    renderFallback() {
        // 如果外部文件加载失败，使用内联模板作为降级方案
        this.shadowRoot.innerHTML = `
            <style>
                .app-footer {
                    background: #2c3e50;
                    color: white;
                    padding: 2rem;
                    text-align: center;
                }
            </style>
            <footer class="app-footer">
                <p>&copy; ${new Date().getFullYear()} 我的网站</p>
            </footer>
        `;
    }
}

// 自动注册组件
customElements.define('app-footer', AppFooter);