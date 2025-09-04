/**
 * 交互管理器 - 统一管理页面交互效果和微交互
 */
class InteractionManager {
    constructor() {
        this.observers = new Map();
        this.rippleElements = new Set();
        this.scrollElements = new Set();
        this.isInitialized = false;
        
        // 绑定方法
        this.handleRippleClick = this.handleRippleClick.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleKeyboard = this.handleKeyboard.bind(this);
    }
    
    /**
     * 初始化交互管理器
     */
    init() {
        if (this.isInitialized) return;
        
        this.setupRippleEffect();
        this.setupScrollAnimations();
        this.setupHoverEffects();
        this.setupKeyboardNavigation();
        this.setupLoadingAnimations();
        this.setupPageTransitions();
        this.setupAccessibility();
        
        // 添加事件监听
        this.addEventListeners();
        
        this.isInitialized = true;
        console.log('InteractionManager initialized');
    }
    
    /**
     * 设置波纹效果
     */
    setupRippleEffect() {
        // 为按钮和可点击元素添加波纹效果
        const rippleSelectors = [
            '.btn',
            '.card',
            '.feature-card',
            '[data-ripple]',
            'button:not([data-no-ripple])'
        ];
        
        rippleSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                this.addRippleEffect(element);
            });
        });
    }
    
    /**
     * 为元素添加波纹效果
     */
    addRippleEffect(element) {
        if (this.rippleElements.has(element)) return;
        
        element.classList.add('btn-ripple');
        element.addEventListener('click', this.handleRippleClick);
        this.rippleElements.add(element);
    }
    
    /**
     * 处理波纹点击事件
     */
    handleRippleClick(event) {
        const element = event.currentTarget;
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        element.appendChild(ripple);
        
        // 移除波纹元素
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }
    
    /**
     * 设置滚动动画
     */
    setupScrollAnimations() {
        // 创建 Intersection Observer
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    // 添加延迟动画
                    const delay = entry.target.dataset.delay || 0;
                    if (delay > 0) {
                        entry.target.style.animationDelay = delay + 'ms';
                    }
                }
            });
        }, observerOptions);
        
        // 观察需要滚动动画的元素
        const scrollElements = document.querySelectorAll([
            '.scroll-reveal',
            '.feature-card',
            '.stats-item',
            '[data-scroll-reveal]'
        ].join(','));
        
        scrollElements.forEach((element, index) => {
            element.classList.add('scroll-reveal');
            // 添加渐进延迟
            if (!element.dataset.delay) {
                element.dataset.delay = index * 100;
            }
            scrollObserver.observe(element);
            this.scrollElements.add(element);
        });
        
        this.observers.set('scroll', scrollObserver);
    }
    
    /**
     * 设置悬停效果
     */
    setupHoverEffects() {
        // 为卡片添加悬停效果
        document.querySelectorAll('.card, .feature-card').forEach(card => {
            card.classList.add('hover-lift');
        });
        
        // 为按钮添加悬停效果
        document.querySelectorAll('.btn').forEach(btn => {
            if (!btn.classList.contains('btn-outline')) {
                btn.classList.add('hover-scale');
            }
        });
        
        // 为图标添加悬停效果
        document.querySelectorAll('.icon, [class*="icon-"]').forEach(icon => {
            icon.classList.add('hover-rotate');
        });
    }
    
    /**
     * 设置键盘导航
     */
    setupKeyboardNavigation() {
        // 为可聚焦元素添加键盘导航支持
        const focusableElements = document.querySelectorAll([
            'button',
            'a[href]',
            'input',
            'select',
            'textarea',
            '[tabindex]:not([tabindex="-1"])'
        ].join(','));
        
        focusableElements.forEach(element => {
            element.addEventListener('keydown', this.handleKeyboard);
        });
        
        // 添加焦点指示器
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });
        
        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });
    }
    
    /**
     * 处理键盘事件
     */
    handleKeyboard(event) {
        const element = event.target;
        
        // Enter 键激活
        if (event.key === 'Enter' && element.tagName !== 'BUTTON') {
            if (element.hasAttribute('data-action') || element.hasAttribute('href')) {
                element.click();
            }
        }
        
        // 空格键激活按钮
        if (event.key === ' ' && element.tagName === 'BUTTON') {
            event.preventDefault();
            element.click();
        }
        
        // Escape 键关闭模态框
        if (event.key === 'Escape') {
            const modal = document.querySelector('.modal.show');
            if (modal) {
                this.closeModal(modal);
            }
        }
    }
    
    /**
     * 设置加载动画
     */
    setupLoadingAnimations() {
        // 页面加载完成后显示内容
        window.addEventListener('load', () => {
            document.body.classList.add('loaded');
            
            // 为页面元素添加渐入动画
            const pageElements = document.querySelectorAll([
                'header',
                'main',
                'footer',
                '.hero-section',
                '.features-section'
            ].join(','));
            
            pageElements.forEach((element, index) => {
                setTimeout(() => {
                    element.classList.add('animate-fade-in');
                }, index * 100);
            });
        });
        
        // 为异步加载的内容添加动画
        this.setupContentLoadingAnimation();
    }
    
    /**
     * 设置内容加载动画
     */
    setupContentLoadingAnimation() {
        // 监听动态内容加载
        const contentObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 为新添加的元素添加动画
                        if (node.classList.contains('card') || 
                            node.classList.contains('feature-card')) {
                            node.classList.add('animate-scale-in');
                        }
                        
                        // 为新添加的按钮添加波纹效果
                        if (node.matches('.btn, button')) {
                            this.addRippleEffect(node);
                        }
                    }
                });
            });
        });
        
        contentObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this.observers.set('content', contentObserver);
    }
    
    /**
     * 设置页面过渡
     */
    setupPageTransitions() {
        // 为页面导航添加过渡效果
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && !link.hasAttribute('target') && 
                link.hostname === window.location.hostname) {
                
                e.preventDefault();
                this.navigateWithTransition(link.href);
            }
        });
    }
    
    /**
     * 带过渡效果的页面导航
     */
    navigateWithTransition(url) {
        document.body.classList.add('page-transitioning');
        
        setTimeout(() => {
            window.location.href = url;
        }, 300);
    }
    
    /**
     * 设置无障碍功能
     */
    setupAccessibility() {
        // 为图片添加 alt 属性检查
        document.querySelectorAll('img:not([alt])').forEach(img => {
            console.warn('Image missing alt attribute:', img);
            img.setAttribute('alt', '');
        });
        
        // 为按钮添加 aria-label
        document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])').forEach(btn => {
            if (!btn.textContent.trim()) {
                const action = btn.getAttribute('data-action');
                if (action) {
                    btn.setAttribute('aria-label', action);
                }
            }
        });
        
        // 添加跳转到主内容的链接
        this.addSkipLink();
    }
    
    /**
     * 添加跳转到主内容的链接
     */
    addSkipLink() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.textContent = '跳转到主内容';
        skipLink.className = 'skip-link';
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: var(--color-primary);
            color: white;
            padding: 8px;
            text-decoration: none;
            border-radius: 4px;
            z-index: 1000;
            transition: top 0.3s;
        `;
        
        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '6px';
        });
        
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
    }
    
    /**
     * 显示通知
     */
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" aria-label="关闭通知">&times;</button>
            </div>
        `;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-bg-primary);
            border: 1px solid var(--color-border-color);
            border-radius: var(--border-radius);
            padding: 16px;
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        // 显示动画
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // 关闭按钮事件
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        // 自动关闭
        if (duration > 0) {
            setTimeout(() => {
                this.hideNotification(notification);
            }, duration);
        }
        
        return notification;
    }
    
    /**
     * 隐藏通知
     */
    hideNotification(notification) {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    /**
     * 显示模态框
     */
    showModal(content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${options.title || ''}</h3>
                    <button class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 显示动画
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
        
        // 事件监听
        modal.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal(modal);
        });
        
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            this.closeModal(modal);
        });
        
        return modal;
    }
    
    /**
     * 关闭模态框
     */
    closeModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
    
    /**
     * 创建加载指示器
     */
    createLoader(type = 'spinner') {
        const loader = document.createElement('div');
        
        if (type === 'spinner') {
            loader.className = 'loading-spinner';
        } else if (type === 'dots') {
            loader.className = 'loading-dots';
            loader.innerHTML = '<div></div><div></div><div></div><div></div>';
        }
        
        return loader;
    }
    
    /**
     * 添加事件监听器
     */
    addEventListeners() {
        window.addEventListener('scroll', this.handleScroll, { passive: true });
        window.addEventListener('resize', this.handleResize, { passive: true });
        
        // 性能优化：使用防抖
        this.handleScroll = this.debounce(this.handleScroll, 16);
        this.handleResize = this.debounce(this.handleResize, 250);
    }
    
    /**
     * 处理滚动事件
     */
    handleScroll() {
        // 视差滚动效果
        const parallaxElements = document.querySelectorAll('.parallax');
        const scrollTop = window.pageYOffset;
        
        parallaxElements.forEach(element => {
            const speed = element.dataset.speed || 0.5;
            const yPos = -(scrollTop * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
        
        // 滚动到顶部按钮
        const scrollTopBtn = document.querySelector('.scroll-to-top');
        if (scrollTopBtn) {
            if (scrollTop > 300) {
                scrollTopBtn.classList.add('show');
            } else {
                scrollTopBtn.classList.remove('show');
            }
        }
    }
    
    /**
     * 处理窗口大小变化
     */
    handleResize() {
        // 重新计算动画元素位置
        this.scrollElements.forEach(element => {
            if (element.classList.contains('revealed')) {
                element.style.transform = '';
            }
        });
    }
    
    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 节流函数
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 销毁交互管理器
     */
    destroy() {
        // 移除事件监听器
        window.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        
        // 清理观察者
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();
        
        // 清理波纹效果
        this.rippleElements.forEach(element => {
            element.removeEventListener('click', this.handleRippleClick);
        });
        this.rippleElements.clear();
        
        this.isInitialized = false;
    }
}

// 创建全局实例
const interactionManager = new InteractionManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InteractionManager;
} else {
    window.InteractionManager = InteractionManager;
    window.interactionManager = interactionManager;
}