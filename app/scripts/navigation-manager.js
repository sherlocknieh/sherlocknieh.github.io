/**
 * 导航管理器 - 统一管理页面导航、面包屑和路由
 */
class NavigationManager {
    constructor() {
        this.currentPath = window.location.pathname;
        this.history = [];
        this.breadcrumbs = [];
        this.navigationItems = new Map();
        this.isInitialized = false;
        
        // 路由配置
        this.routes = {
            '/': { title: '首页', icon: 'home', parent: null },
            '/about': { title: '关于我', icon: 'user', parent: '/' },
            '/projects': { title: '项目展示', icon: 'folder', parent: '/' },
            '/blog': { title: '博客', icon: 'edit', parent: '/' },
            '/contact': { title: '联系方式', icon: 'mail', parent: '/' },
            '/skills': { title: '技能专长', icon: 'code', parent: '/about' },
            '/experience': { title: '工作经历', icon: 'briefcase', parent: '/about' }
        };
        
        // 绑定方法
        this.handleNavigation = this.handleNavigation.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
    }
    
    /**
     * 初始化导航管理器
     */
    init() {
        if (this.isInitialized) return;
        
        this.setupNavigationItems();
        this.setupBreadcrumbs();
        this.setupActiveStates();
        this.setupKeyboardNavigation();
        this.setupMobileNavigation();
        this.addEventListeners();
        
        // 初始化当前页面状态
        this.updateCurrentPage();
        
        this.isInitialized = true;
        console.log('NavigationManager initialized');
    }
    
    /**
     * 设置导航项
     */
    setupNavigationItems() {
        // 查找所有导航链接
        const navLinks = document.querySelectorAll([
            'nav a[href]',
            '.nav-link',
            '[data-nav-item]',
            '.sidebar a[href]',
            '.menu a[href]'
        ].join(','));
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('http')) {
                this.navigationItems.set(href, {
                    element: link,
                    title: link.textContent.trim() || this.getRouteTitle(href),
                    icon: link.dataset.icon || this.getRouteIcon(href)
                });
                
                // 添加点击事件
                link.addEventListener('click', this.handleNavigation);
            }
        });
    }
    
    /**
     * 设置面包屑导航
     */
    setupBreadcrumbs() {
        // 查找或创建面包屑容器
        let breadcrumbContainer = document.querySelector('.breadcrumb, .breadcrumbs');
        
        if (!breadcrumbContainer) {
            breadcrumbContainer = this.createBreadcrumbContainer();
        }
        
        this.breadcrumbContainer = breadcrumbContainer;
        this.updateBreadcrumbs();
    }
    
    /**
     * 创建面包屑容器
     */
    createBreadcrumbContainer() {
        const container = document.createElement('nav');
        container.className = 'breadcrumb';
        container.setAttribute('aria-label', '面包屑导航');
        
        // 添加样式
        container.style.cssText = `
            padding: 12px 0;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--color-border-light);
        `;
        
        // 插入到主内容区域顶部
        const mainContent = document.querySelector('main, .main-content, #main-content');
        if (mainContent) {
            mainContent.insertBefore(container, mainContent.firstChild);
        }
        
        return container;
    }
    
    /**
     * 更新面包屑
     */
    updateBreadcrumbs() {
        if (!this.breadcrumbContainer) return;
        
        const breadcrumbs = this.generateBreadcrumbs(this.currentPath);
        
        this.breadcrumbContainer.innerHTML = `
            <ol class="breadcrumb-list">
                ${breadcrumbs.map((crumb, index) => `
                    <li class="breadcrumb-item ${index === breadcrumbs.length - 1 ? 'active' : ''}">
                        ${index === breadcrumbs.length - 1 ? 
                            `<span aria-current="page">${crumb.title}</span>` :
                            `<a href="${crumb.path}">${crumb.title}</a>`
                        }
                        ${index < breadcrumbs.length - 1 ? '<span class="breadcrumb-separator">/</span>' : ''}
                    </li>
                `).join('')}
            </ol>
        `;
        
        // 添加面包屑样式
        this.addBreadcrumbStyles();
    }
    
    /**
     * 生成面包屑路径
     */
    generateBreadcrumbs(path) {
        const breadcrumbs = [];
        let currentPath = path;
        
        // 构建面包屑链
        while (currentPath) {
            const route = this.routes[currentPath];
            if (route) {
                breadcrumbs.unshift({
                    path: currentPath,
                    title: route.title,
                    icon: route.icon
                });
                currentPath = route.parent;
            } else {
                break;
            }
        }
        
        return breadcrumbs;
    }
    
    /**
     * 添加面包屑样式
     */
    addBreadcrumbStyles() {
        if (document.querySelector('#breadcrumb-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'breadcrumb-styles';
        style.textContent = `
            .breadcrumb-list {
                display: flex;
                align-items: center;
                list-style: none;
                margin: 0;
                padding: 0;
                font-size: var(--font-size-sm);
            }
            
            .breadcrumb-item {
                display: flex;
                align-items: center;
            }
            
            .breadcrumb-item a {
                color: var(--color-text-secondary);
                text-decoration: none;
                transition: color var(--transition-normal);
            }
            
            .breadcrumb-item a:hover {
                color: var(--color-primary);
                text-decoration: underline;
            }
            
            .breadcrumb-item.active span {
                color: var(--color-text-primary);
                font-weight: 500;
            }
            
            .breadcrumb-separator {
                margin: 0 8px;
                color: var(--color-text-muted);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 设置活跃状态
     */
    setupActiveStates() {
        this.updateActiveStates();
    }
    
    /**
     * 更新活跃状态
     */
    updateActiveStates() {
        // 移除所有活跃状态
        document.querySelectorAll('.nav-item.active, .nav-link.active').forEach(item => {
            item.classList.remove('active');
        });
        
        // 设置当前页面的活跃状态
        this.navigationItems.forEach((item, href) => {
            if (href === this.currentPath || 
                (this.currentPath !== '/' && href !== '/' && this.currentPath.startsWith(href))) {
                item.element.classList.add('active');
                
                // 为父级导航项也添加活跃状态
                const parentItem = item.element.closest('.nav-item');
                if (parentItem) {
                    parentItem.classList.add('active');
                }
            }
        });
    }
    
    /**
     * 设置键盘导航
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Alt + 数字键快速导航
            if (e.altKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                const navItems = Array.from(this.navigationItems.values());
                if (navItems[index]) {
                    this.navigateTo(navItems[index].element.getAttribute('href'));
                }
            }
            
            // Alt + Home 回到首页
            if (e.altKey && e.key === 'Home') {
                e.preventDefault();
                this.navigateTo('/');
            }
            
            // Alt + 左箭头 后退
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.goBack();
            }
            
            // Alt + 右箭头 前进
            if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                this.goForward();
            }
        });
    }
    
    /**
     * 设置移动端导航
     */
    setupMobileNavigation() {
        // 查找移动端菜单切换按钮
        const menuToggle = document.querySelector('.menu-toggle, .nav-toggle, [data-toggle="menu"]');
        const mobileMenu = document.querySelector('.mobile-menu, .nav-mobile, .sidebar');
        
        if (menuToggle && mobileMenu) {
            menuToggle.addEventListener('click', () => {
                const isOpen = mobileMenu.classList.contains('open');
                
                if (isOpen) {
                    this.closeMobileMenu(mobileMenu);
                } else {
                    this.openMobileMenu(mobileMenu);
                }
            });
            
            // 点击外部关闭菜单
            document.addEventListener('click', (e) => {
                if (!mobileMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                    this.closeMobileMenu(mobileMenu);
                }
            });
            
            // ESC 键关闭菜单
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeMobileMenu(mobileMenu);
                }
            });
        }
    }
    
    /**
     * 打开移动端菜单
     */
    openMobileMenu(menu) {
        menu.classList.add('open');
        document.body.classList.add('menu-open');
        
        // 设置焦点到第一个导航项
        const firstNavItem = menu.querySelector('a, button');
        if (firstNavItem) {
            firstNavItem.focus();
        }
    }
    
    /**
     * 关闭移动端菜单
     */
    closeMobileMenu(menu) {
        menu.classList.remove('open');
        document.body.classList.remove('menu-open');
    }
    
    /**
     * 处理导航点击
     */
    handleNavigation(event) {
        const link = event.currentTarget;
        const href = link.getAttribute('href');
        
        // 检查是否是外部链接
        if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return; // 让浏览器处理外部链接
        }
        
        // 检查是否是锚点链接
        if (href.startsWith('#')) {
            this.scrollToAnchor(href.substring(1));
            return;
        }
        
        // 阻止默认行为，使用自定义导航
        event.preventDefault();
        this.navigateTo(href);
    }
    
    /**
     * 导航到指定路径
     */
    navigateTo(path, options = {}) {
        if (path === this.currentPath && !options.force) {
            return; // 已经在当前页面
        }
        
        // 添加到历史记录
        this.addToHistory(this.currentPath);
        
        // 更新当前路径
        this.currentPath = path;
        
        // 更新浏览器历史
        if (!options.replaceState) {
            history.pushState({ path }, '', path);
        } else {
            history.replaceState({ path }, '', path);
        }
        
        // 更新页面状态
        this.updateCurrentPage();
        
        // 触发导航事件
        this.dispatchNavigationEvent('navigate', {
            from: this.history[this.history.length - 1] || '/',
            to: path,
            options
        });
        
        // 如果不是 SPA，则进行页面跳转
        if (!options.spa) {
            window.location.href = path;
        }
    }
    
    /**
     * 滚动到锚点
     */
    scrollToAnchor(anchorId) {
        const target = document.getElementById(anchorId);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            
            // 更新 URL
            history.replaceState(null, '', `#${anchorId}`);
            
            // 触发锚点导航事件
            this.dispatchNavigationEvent('anchor', { anchorId, target });
        }
    }
    
    /**
     * 后退
     */
    goBack() {
        if (this.history.length > 0) {
            const previousPath = this.history.pop();
            this.navigateTo(previousPath, { replaceState: true });
        } else {
            history.back();
        }
    }
    
    /**
     * 前进
     */
    goForward() {
        history.forward();
    }
    
    /**
     * 添加到历史记录
     */
    addToHistory(path) {
        if (path && path !== this.currentPath) {
            this.history.push(path);
            
            // 限制历史记录长度
            if (this.history.length > 50) {
                this.history.shift();
            }
        }
    }
    
    /**
     * 更新当前页面状态
     */
    updateCurrentPage() {
        // 更新页面标题
        const route = this.routes[this.currentPath];
        if (route) {
            document.title = `${route.title} - 个人主页`;
        }
        
        // 更新面包屑
        this.updateBreadcrumbs();
        
        // 更新活跃状态
        this.updateActiveStates();
        
        // 更新页面元数据
        this.updatePageMeta();
    }
    
    /**
     * 更新页面元数据
     */
    updatePageMeta() {
        const route = this.routes[this.currentPath];
        if (!route) return;
        
        // 更新 meta description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = 'description';
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = `${route.title} - 个人主页`;
        
        // 更新 canonical URL
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = 'canonical';
            document.head.appendChild(canonical);
        }
        canonical.href = window.location.origin + this.currentPath;
    }
    
    /**
     * 处理浏览器后退/前进
     */
    handlePopState(event) {
        const path = event.state?.path || window.location.pathname;
        this.currentPath = path;
        this.updateCurrentPage();
        
        this.dispatchNavigationEvent('popstate', { path });
    }
    
    /**
     * 获取路由标题
     */
    getRouteTitle(path) {
        return this.routes[path]?.title || path.split('/').pop() || '页面';
    }
    
    /**
     * 获取路由图标
     */
    getRouteIcon(path) {
        return this.routes[path]?.icon || 'page';
    }
    
    /**
     * 添加路由
     */
    addRoute(path, config) {
        this.routes[path] = config;
    }
    
    /**
     * 移除路由
     */
    removeRoute(path) {
        delete this.routes[path];
    }
    
    /**
     * 获取当前路径
     */
    getCurrentPath() {
        return this.currentPath;
    }
    
    /**
     * 获取导航历史
     */
    getHistory() {
        return [...this.history];
    }
    
    /**
     * 清空历史记录
     */
    clearHistory() {
        this.history = [];
    }
    
    /**
     * 分发导航事件
     */
    dispatchNavigationEvent(type, detail) {
        const event = new CustomEvent(`navigation:${type}`, {
            detail,
            bubbles: true
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 添加事件监听器
     */
    addEventListeners() {
        window.addEventListener('popstate', this.handlePopState);
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // 页面重新可见时，检查 URL 是否变化
                const currentPath = window.location.pathname;
                if (currentPath !== this.currentPath) {
                    this.currentPath = currentPath;
                    this.updateCurrentPage();
                }
            }
        });
    }
    
    /**
     * 销毁导航管理器
     */
    destroy() {
        // 移除事件监听器
        window.removeEventListener('popstate', this.handlePopState);
        
        // 清理导航项事件
        this.navigationItems.forEach(item => {
            item.element.removeEventListener('click', this.handleNavigation);
        });
        
        this.navigationItems.clear();
        this.history = [];
        this.isInitialized = false;
    }
}

// 创建全局实例
const navigationManager = new NavigationManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
} else {
    window.NavigationManager = NavigationManager;
    window.navigationManager = navigationManager;
}