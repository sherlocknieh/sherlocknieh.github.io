/**
 * 可访问性管理器 - 提升键盘导航和屏幕阅读器支持
 */
class AccessibilityManager {
    constructor() {
        this.focusableElements = [];
        this.currentFocusIndex = -1;
        this.isKeyboardNavigation = false;
        this.announcements = [];
        this.isInitialized = false;
        
        // ARIA 标签配置
        this.ariaLabels = {
            'zh-CN': {
                skipToContent: '跳转到主内容',
                menu: '主菜单',
                search: '搜索',
                close: '关闭',
                previous: '上一个',
                next: '下一个',
                loading: '正在加载',
                error: '错误',
                success: '成功',
                warning: '警告',
                info: '信息',
                expandMenu: '展开菜单',
                collapseMenu: '收起菜单',
                toggleTheme: '切换主题',
                goToTop: '回到顶部'
            },
            'en': {
                skipToContent: 'Skip to main content',
                menu: 'Main menu',
                search: 'Search',
                close: 'Close',
                previous: 'Previous',
                next: 'Next',
                loading: 'Loading',
                error: 'Error',
                success: 'Success',
                warning: 'Warning',
                info: 'Information',
                expandMenu: 'Expand menu',
                collapseMenu: 'Collapse menu',
                toggleTheme: 'Toggle theme',
                goToTop: 'Go to top'
            }
        };
        
        this.currentLanguage = document.documentElement.lang || 'zh-CN';
        
        // 绑定方法
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
    }
    
    /**
     * 初始化可访问性管理器
     */
    init() {
        if (this.isInitialized) return;
        
        this.setupSkipLinks();
        this.setupFocusManagement();
        this.setupKeyboardNavigation();
        this.setupAriaLabels();
        this.setupScreenReaderSupport();
        this.setupColorContrastCheck();
        this.setupMotionPreferences();
        this.setupLiveRegions();
        this.addEventListeners();
        
        this.isInitialized = true;
        console.log('AccessibilityManager initialized');
    }
    
    /**
     * 设置跳转链接
     */
    setupSkipLinks() {
        // 检查是否已存在跳转链接
        if (document.querySelector('.skip-link')) return;
        
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'skip-link';
        skipLink.textContent = this.getAriaLabel('skipToContent');
        skipLink.setAttribute('tabindex', '1');
        
        // 添加样式
        this.addSkipLinkStyles();
        
        // 插入到页面顶部
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // 确保主内容区域有正确的 ID
        this.ensureMainContentId();
    }
    
    /**
     * 添加跳转链接样式
     */
    addSkipLinkStyles() {
        if (document.querySelector('#skip-link-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'skip-link-styles';
        style.textContent = `
            .skip-link {
                position: absolute;
                top: -40px;
                left: 6px;
                background: var(--color-primary);
                color: white;
                padding: 8px 12px;
                text-decoration: none;
                border-radius: var(--border-radius);
                z-index: 10000;
                font-weight: 500;
                transition: top 0.3s ease;
                box-shadow: var(--shadow-lg);
            }
            
            .skip-link:focus {
                top: 6px;
                outline: 2px solid var(--color-warning);
                outline-offset: 2px;
            }
            
            .skip-link:hover {
                background: var(--color-primary-dark);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 确保主内容区域有正确的 ID
     */
    ensureMainContentId() {
        let mainContent = document.querySelector('#main-content');
        
        if (!mainContent) {
            mainContent = document.querySelector('main, .main-content, .content');
            if (mainContent) {
                mainContent.id = 'main-content';
            }
        }
        
        if (mainContent) {
            mainContent.setAttribute('tabindex', '-1');
        }
    }
    
    /**
     * 设置焦点管理
     */
    setupFocusManagement() {
        // 更新可聚焦元素列表
        this.updateFocusableElements();
        
        // 监听 DOM 变化
        const observer = new MutationObserver(() => {
            this.updateFocusableElements();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['tabindex', 'disabled', 'aria-hidden']
        });
        
        // 焦点陷阱管理
        this.setupFocusTraps();
    }
    
    /**
     * 更新可聚焦元素列表
     */
    updateFocusableElements() {
        const focusableSelectors = [
            'a[href]:not([tabindex="-1"])',
            'button:not([disabled]):not([tabindex="-1"])',
            'input:not([disabled]):not([tabindex="-1"])',
            'select:not([disabled]):not([tabindex="-1"])',
            'textarea:not([disabled]):not([tabindex="-1"])',
            '[tabindex]:not([tabindex="-1"])',
            '[contenteditable="true"]:not([tabindex="-1"])'
        ];
        
        this.focusableElements = Array.from(
            document.querySelectorAll(focusableSelectors.join(','))
        ).filter(element => {
            return this.isElementVisible(element) && 
                   !element.closest('[aria-hidden="true"]');
        });
    }
    
    /**
     * 检查元素是否可见
     */
    isElementVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
    }
    
    /**
     * 设置焦点陷阱
     */
    setupFocusTraps() {
        // 为模态框设置焦点陷阱
        document.addEventListener('keydown', (e) => {
            const modal = document.querySelector('.modal.show, [role="dialog"][aria-hidden="false"]');
            if (modal && e.key === 'Tab') {
                this.trapFocus(e, modal);
            }
        });
    }
    
    /**
     * 焦点陷阱
     */
    trapFocus(event, container) {
        const focusableElements = container.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (event.shiftKey) {
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    }
    
    /**
     * 设置键盘导航
     */
    setupKeyboardNavigation() {
        // 添加键盘导航指示器
        this.addKeyboardNavigationStyles();
        
        // 方向键导航
        document.addEventListener('keydown', (e) => {
            // 检查是否在可导航容器中
            const navContainer = e.target.closest('[role="menu"], [role="menubar"], .nav, .menu');
            if (navContainer) {
                this.handleArrowKeyNavigation(e, navContainer);
            }
        });
        
        // 快捷键支持
        this.setupKeyboardShortcuts();
    }
    
    /**
     * 添加键盘导航样式
     */
    addKeyboardNavigationStyles() {
        if (document.querySelector('#keyboard-navigation-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'keyboard-navigation-styles';
        style.textContent = `
            /* 键盘导航时显示焦点指示器 */
            body.keyboard-navigation *:focus {
                outline: 2px solid var(--color-primary) !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 0 4px rgba(var(--color-primary-rgb), 0.2) !important;
            }
            
            /* 高对比度焦点指示器 */
            @media (prefers-contrast: high) {
                body.keyboard-navigation *:focus {
                    outline: 3px solid var(--color-warning) !important;
                    outline-offset: 3px !important;
                }
            }
            
            /* 焦点可见性增强 */
            .focus-visible {
                outline: 2px solid var(--color-primary);
                outline-offset: 2px;
            }
            
            /* 跳过链接动画 */
            .skip-link:focus {
                animation: skipLinkFocus 0.3s ease;
            }
            
            @keyframes skipLinkFocus {
                0% {
                    transform: translateY(-10px);
                    opacity: 0;
                }
                100% {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 处理方向键导航
     */
    handleArrowKeyNavigation(event, container) {
        const items = Array.from(container.querySelectorAll(
            'a[href], button:not([disabled]), [role="menuitem"], [role="tab"]'
        ));
        
        const currentIndex = items.indexOf(event.target);
        let nextIndex = currentIndex;
        
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                event.preventDefault();
                nextIndex = (currentIndex + 1) % items.length;
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                event.preventDefault();
                nextIndex = (currentIndex - 1 + items.length) % items.length;
                break;
            case 'Home':
                event.preventDefault();
                nextIndex = 0;
                break;
            case 'End':
                event.preventDefault();
                nextIndex = items.length - 1;
                break;
        }
        
        if (nextIndex !== currentIndex && items[nextIndex]) {
            items[nextIndex].focus();
        }
    }
    
    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        const shortcuts = {
            'Alt+1': () => this.focusElement('#main-content'),
            'Alt+2': () => this.focusElement('nav, .nav, .menu'),
            'Alt+3': () => this.focusElement('.search, [type="search"]'),
            'Alt+H': () => this.navigateToHome(),
            'Alt+M': () => this.toggleMenu(),
            'Alt+T': () => this.toggleTheme(),
            'Escape': () => this.handleEscape(),
            '?': () => this.showKeyboardShortcuts()
        };
        
        document.addEventListener('keydown', (e) => {
            const key = this.getShortcutKey(e);
            if (shortcuts[key]) {
                e.preventDefault();
                shortcuts[key]();
            }
        });
    }
    
    /**
     * 获取快捷键字符串
     */
    getShortcutKey(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        if (event.metaKey) parts.push('Meta');
        parts.push(event.key);
        return parts.join('+');
    }
    
    /**
     * 设置 ARIA 标签
     */
    setupAriaLabels() {
        // 为没有标签的元素添加 ARIA 标签
        const elementsNeedingLabels = [
            { selector: 'button[data-action="toggle-theme"]', label: 'toggleTheme' },
            { selector: 'button[data-action="toggle-menu"]', label: 'expandMenu' },
            { selector: '.menu-toggle', label: 'expandMenu' },
            { selector: '.close-button', label: 'close' },
            { selector: '.search-button', label: 'search' },
            { selector: '.scroll-to-top', label: 'goToTop' }
        ];
        
        elementsNeedingLabels.forEach(({ selector, label }) => {
            document.querySelectorAll(selector).forEach(element => {
                if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
                    element.setAttribute('aria-label', this.getAriaLabel(label));
                }
            });
        });
        
        // 设置地标角色
        this.setupLandmarkRoles();
    }
    
    /**
     * 设置地标角色
     */
    setupLandmarkRoles() {
        const landmarks = [
            { selector: 'header, .header', role: 'banner' },
            { selector: 'nav, .nav, .navigation', role: 'navigation' },
            { selector: 'main, .main, .main-content', role: 'main' },
            { selector: 'aside, .sidebar', role: 'complementary' },
            { selector: 'footer, .footer', role: 'contentinfo' },
            { selector: '.search, .search-form', role: 'search' }
        ];
        
        landmarks.forEach(({ selector, role }) => {
            document.querySelectorAll(selector).forEach(element => {
                if (!element.getAttribute('role')) {
                    element.setAttribute('role', role);
                }
            });
        });
    }
    
    /**
     * 设置屏幕阅读器支持
     */
    setupScreenReaderSupport() {
        // 创建实时区域
        this.createLiveRegion();
        
        // 为图片添加 alt 属性检查
        this.checkImageAltText();
        
        // 为表单添加标签关联
        this.setupFormLabels();
        
        // 设置状态公告
        this.setupStatusAnnouncements();
    }
    
    /**
     * 创建实时区域
     */
    createLiveRegion() {
        if (document.querySelector('#aria-live-region')) return;
        
        const liveRegion = document.createElement('div');
        liveRegion.id = 'aria-live-region';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        
        document.body.appendChild(liveRegion);
        this.liveRegion = liveRegion;
    }
    
    /**
     * 公告消息给屏幕阅读器
     */
    announce(message, priority = 'polite') {
        if (!this.liveRegion) return;
        
        this.liveRegion.setAttribute('aria-live', priority);
        this.liveRegion.textContent = message;
        
        // 清空消息以便下次公告
        setTimeout(() => {
            this.liveRegion.textContent = '';
        }, 1000);
    }
    
    /**
     * 检查图片 alt 属性
     */
    checkImageAltText() {
        document.querySelectorAll('img').forEach(img => {
            if (!img.hasAttribute('alt')) {
                console.warn('Image missing alt attribute:', img);
                img.setAttribute('alt', '');
            }
        });
    }
    
    /**
     * 设置表单标签
     */
    setupFormLabels() {
        document.querySelectorAll('input, select, textarea').forEach(input => {
            if (!input.getAttribute('aria-label') && 
                !input.getAttribute('aria-labelledby') && 
                !document.querySelector(`label[for="${input.id}"]`)) {
                
                const placeholder = input.getAttribute('placeholder');
                if (placeholder) {
                    input.setAttribute('aria-label', placeholder);
                }
            }
        });
    }
    
    /**
     * 设置状态公告
     */
    setupStatusAnnouncements() {
        // 监听页面状态变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'aria-expanded') {
                    const element = mutation.target;
                    const isExpanded = element.getAttribute('aria-expanded') === 'true';
                    const label = isExpanded ? 'collapseMenu' : 'expandMenu';
                    this.announce(this.getAriaLabel(label));
                }
            });
        });
        
        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['aria-expanded', 'aria-selected', 'aria-checked']
        });
    }
    
    /**
     * 设置颜色对比度检查
     */
    setupColorContrastCheck() {
        // 检查是否需要高对比度模式
        if (window.matchMedia('(prefers-contrast: high)').matches) {
            document.body.classList.add('high-contrast');
        }
        
        // 监听对比度偏好变化
        window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
            if (e.matches) {
                document.body.classList.add('high-contrast');
            } else {
                document.body.classList.remove('high-contrast');
            }
        });
    }
    
    /**
     * 设置动画偏好
     */
    setupMotionPreferences() {
        // 检查是否偏好减少动画
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.body.classList.add('reduce-motion');
        }
        
        // 监听动画偏好变化
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            if (e.matches) {
                document.body.classList.add('reduce-motion');
            } else {
                document.body.classList.remove('reduce-motion');
            }
        });
    }
    
    /**
     * 设置实时区域
     */
    setupLiveRegions() {
        // 为状态消息创建实时区域
        const statusRegion = document.createElement('div');
        statusRegion.id = 'status-region';
        statusRegion.setAttribute('aria-live', 'polite');
        statusRegion.setAttribute('aria-atomic', 'true');
        statusRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        
        document.body.appendChild(statusRegion);
        this.statusRegion = statusRegion;
    }
    
    /**
     * 获取 ARIA 标签
     */
    getAriaLabel(key) {
        return this.ariaLabels[this.currentLanguage]?.[key] || 
               this.ariaLabels['zh-CN'][key] || 
               key;
    }
    
    /**
     * 聚焦元素
     */
    focusElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.focus();
            return true;
        }
        return false;
    }
    
    /**
     * 导航到首页
     */
    navigateToHome() {
        const homeLink = document.querySelector('a[href="/"], a[href="#home"]');
        if (homeLink) {
            homeLink.click();
        } else {
            window.location.href = '/';
        }
    }
    
    /**
     * 切换菜单
     */
    toggleMenu() {
        const menuToggle = document.querySelector('.menu-toggle, [data-action="toggle-menu"]');
        if (menuToggle) {
            menuToggle.click();
        }
    }
    
    /**
     * 切换主题
     */
    toggleTheme() {
        const themeToggle = document.querySelector('[data-action="toggle-theme"]');
        if (themeToggle) {
            themeToggle.click();
        }
    }
    
    /**
     * 处理 Escape 键
     */
    handleEscape() {
        // 关闭模态框
        const modal = document.querySelector('.modal.show');
        if (modal) {
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.click();
            }
            return;
        }
        
        // 关闭菜单
        const openMenu = document.querySelector('.menu.open, .nav.open');
        if (openMenu) {
            this.toggleMenu();
            return;
        }
        
        // 清除搜索
        const searchInput = document.querySelector('.search input[type="search"]');
        if (searchInput && searchInput.value) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }
    }
    
    /**
     * 显示键盘快捷键帮助
     */
    showKeyboardShortcuts() {
        const shortcuts = [
            { key: 'Alt + 1', description: '跳转到主内容' },
            { key: 'Alt + 2', description: '跳转到导航' },
            { key: 'Alt + 3', description: '跳转到搜索' },
            { key: 'Alt + H', description: '返回首页' },
            { key: 'Alt + M', description: '切换菜单' },
            { key: 'Alt + T', description: '切换主题' },
            { key: 'Escape', description: '关闭弹窗/菜单' },
            { key: '?', description: '显示快捷键帮助' }
        ];
        
        const content = `
            <h3>键盘快捷键</h3>
            <ul style="list-style: none; padding: 0;">
                ${shortcuts.map(shortcut => `
                    <li style="margin: 8px 0; display: flex; justify-content: space-between;">
                        <kbd style="background: var(--color-bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">${shortcut.key}</kbd>
                        <span>${shortcut.description}</span>
                    </li>
                `).join('')}
            </ul>
        `;
        
        // 使用交互管理器显示模态框
        if (window.interactionManager) {
            window.interactionManager.showModal(content, {
                title: '键盘快捷键帮助'
            });
        }
    }
    
    /**
     * 处理键盘事件
     */
    handleKeyDown(event) {
        // 标记键盘导航
        if (event.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
            this.isKeyboardNavigation = true;
        }
    }
    
    /**
     * 处理焦点事件
     */
    handleFocus(event) {
        if (this.isKeyboardNavigation) {
            event.target.classList.add('focus-visible');
        }
    }
    
    /**
     * 处理失焦事件
     */
    handleBlur(event) {
        event.target.classList.remove('focus-visible');
    }
    
    /**
     * 添加事件监听器
     */
    addEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('focus', this.handleFocus, true);
        document.addEventListener('blur', this.handleBlur, true);
        
        // 鼠标点击时移除键盘导航标记
        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
            this.isKeyboardNavigation = false;
        });
    }
    
    /**
     * 销毁可访问性管理器
     */
    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('focus', this.handleFocus, true);
        document.removeEventListener('blur', this.handleBlur, true);
        
        this.focusableElements = [];
        this.isInitialized = false;
    }
}

// 创建全局实例
const accessibilityManager = new AccessibilityManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityManager;
} else {
    window.AccessibilityManager = AccessibilityManager;
    window.accessibilityManager = accessibilityManager;
}