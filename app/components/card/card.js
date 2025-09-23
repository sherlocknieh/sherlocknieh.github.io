/**
 * 卡片Web组件
 * 提供圆角矩形边框，鼠标悬停时边框变亮效果
 */
class CardComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['title', 'content', 'variant', 'clickable'];
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.render();
        }
    }

    get title() {
        return this.getAttribute('title') || '';
    }

    set title(value) {
        this.setAttribute('title', value);
    }

    get content() {
        return this.getAttribute('content') || '';
    }

    set content(value) {
        this.setAttribute('content', value);
    }

    get variant() {
        return this.getAttribute('variant') || '';
    }

    set variant(value) {
        this.setAttribute('variant', value);
    }

    get clickable() {
        return this.hasAttribute('clickable');
    }

    set clickable(value) {
        if (value) {
            this.setAttribute('clickable', '');
        } else {
            this.removeAttribute('clickable');
        }
    }

    render() {
        const styles = `
            <style>
                :host {
                    display: block;
                    margin: 16px 0;
                }
                
                .card {
                    padding: 20px;
                    background-color: #ffffff;
                    border: 2px solid #e0e0e0;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                    color: #333;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .card:hover {
                    border-color: #4a90e2;
                    box-shadow: 0 4px 16px rgba(74, 144, 226, 0.2);
                    transform: translateY(-2px);
                }
                
                .card.clickable {
                    cursor: pointer;
                }
                
                .card.clickable:hover {
                    border-color: #357abd;
                    box-shadow: 0 6px 20px rgba(53, 122, 189, 0.25);
                }
                
                .card-title {
                    margin: 0 0 12px 0;
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #2c3e50;
                    line-height: 1.4;
                }
                
                .card-content {
                    margin: 0;
                    font-size: 0.95rem;
                    line-height: 1.6;
                    color: #555;
                }
                
                .card-content ::slotted(p) {
                    margin: 0 0 12px 0;
                }
                
                .card-content ::slotted(p:last-child) {
                    margin-bottom: 0;
                }
                
                /* 样式变体 */
                .card.primary {
                    border-color: #4a90e2;
                    background: linear-gradient(135deg, #f8fbff 0%, #ffffff 100%);
                }
                
                .card.primary:hover {
                    border-color: #357abd;
                    background: linear-gradient(135deg, #f0f8ff 0%, #ffffff 100%);
                }
                
                .card.success {
                    border-color: #28a745;
                    background: linear-gradient(135deg, #f8fff9 0%, #ffffff 100%);
                }
                
                .card.success:hover {
                    border-color: #1e7e34;
                    background: linear-gradient(135deg, #f0fff1 0%, #ffffff 100%);
                }
                
                .card.warning {
                    border-color: #ffc107;
                    background: linear-gradient(135deg, #fffef8 0%, #ffffff 100%);
                }
                
                .card.warning:hover {
                    border-color: #e0a800;
                    background: linear-gradient(135deg, #fffdf0 0%, #ffffff 100%);
                }
                
                @media (max-width: 768px) {
                    .card {
                        padding: 16px;
                        border-radius: 8px;
                    }
                    
                    .card-title {
                        font-size: 1.1rem;
                    }
                    
                    .card-content {
                        font-size: 0.9rem;
                    }
                }
            </style>
        `;

        const cardClass = `card ${this.variant} ${this.clickable ? 'clickable' : ''}`.trim();
        
        const template = `
            ${styles}
            <div class="${cardClass}">
                ${this.title ? `<h3 class="card-title">${this.title}</h3>` : ''}
                <div class="card-content">
                    ${this.content ? this.content : '<slot></slot>'}
                </div>
            </div>
        `;

        this.shadowRoot.innerHTML = template;
    }

    setupEventListeners() {
        if (this.clickable) {
            const card = this.shadowRoot.querySelector('.card');
            card.addEventListener('click', (e) => {
                this.dispatchEvent(new CustomEvent('card-click', {
                    detail: {
                        title: this.title,
                        content: this.content,
                        variant: this.variant
                    },
                    bubbles: true
                }));
            });
        }
    }
}

// 注册自定义元素
customElements.define('card-component', CardComponent);
