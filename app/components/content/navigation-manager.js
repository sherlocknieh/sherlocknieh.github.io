/**
 * 导航管理器
 * 处理页面导航、路由和历史记录管理
 */
export class NavigationManager {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.history = [];
        this.maxHistorySize = 50;
        this.navigationListeners = new Set();
        this.beforeNavigationHooks = new Set();
        this.afterNavigationHooks = new Set();
        this.isNavigating = false;
        
        // 初始化默认路由
        this.initializeDefaultRoutes();
        
        // 监听浏览器前进后退
        this.initializePopStateListener();
    }

    /**
     * 初始化默认路由
     */
    initializeDefaultRoutes() {
        this.addRoute('home', {
            title: '首页',
            description: '欢迎来到我的个人网站',
            handler: () => this.navigateToSection('hero-section'),
            icon: '🏠'
        });

        this.addRoute('about', {
            title: '关于我',
            description: '了解更多关于我的信息',
            handler: () => this.navigateToSection('about-section'),
            icon: '👤'
        });

        this.addRoute('projects', {
            title: '项目展示',
            description: '查看我的项目作品',
            handler: () => this.navigateToSection('projects-section'),
            icon: '💼'
        });

        this.addRoute('skills', {
            title: '技能专长',
            description: '我的技术技能和专业能力',
            handler: () => this.navigateToSection('skills-section'),
            icon: '🛠️'
        });

        this.addRoute('contact', {
            title: '联系方式',
            description: '与我取得联系',
            handler: () => this.navigateToSection('contact-section'),
            icon: '📧'
        });

        this.addRoute('blog', {
            title: '博客文章',
            description: '阅读我的技术博客',
            handler: () => this.navigateToExternalUrl('/blog'),
            icon: '📝',
            external: true
        });
    }

    /**
     * 初始化浏览器历史监听
     */
    initializePopStateListener() {
        if (typeof window !== 'undefined') {
            window.addEventListener('popstate', (event) => {
                if (event.state && event.state.route) {
                    this.navigateToRoute(event.state.route, { updateHistory: false });
                }
            });
        }
    }

    /**
     * 添加路由
     * @param {string} name - 路由名称
     * @param {Object} config - 路由配置
     */
    addRoute(name, config) {
        this.routes.set(name, {
            name,
            title: config.title || name,
            description: config.description || '',
            handler: config.handler || (() => {}),
            icon: config.icon || '📄',
            external: config.external || false,
            requiresAuth: config.requiresAuth || false,
            metadata: config.metadata || {}
        });
    }

    /**
     * 移除路由
     * @param {string} name - 路由名称
     */
    removeRoute(name) {
        this.routes.delete(name);
    }

    /**
     * 获取路由信息
     * @param {string} name - 路由名称
     * @returns {Object|null} 路由配置
     */
    getRoute(name) {
        return this.routes.get(name) || null;
    }

    /**
     * 获取所有路由
     * @returns {Array} 路由列表
     */
    getAllRoutes() {
        return Array.from(this.routes.values());
    }

    /**
     * 导航到指定路由
     * @param {string} routeName - 路由名称
     * @param {Object} options - 导航选项
     * @returns {Promise<boolean>} 导航是否成功
     */
    async navigateToRoute(routeName, options = {}) {
        if (this.isNavigating) {
            console.warn('Navigation already in progress');
            return false;
        }

        const route = this.getRoute(routeName);
        if (!route) {
            console.error(`Route '${routeName}' not found`);
            return false;
        }

        this.isNavigating = true;

        try {
            // 执行导航前钩子
            const canNavigate = await this.executeBeforeNavigationHooks(route, options);
            if (!canNavigate) {
                this.isNavigating = false;
                return false;
            }

            // 记录当前路由到历史
            if (this.currentRoute && options.updateHistory !== false) {
                this.addToHistory(this.currentRoute);
            }

            // 更新浏览器历史
            if (options.updateHistory !== false && typeof window !== 'undefined') {
                const url = options.url || `#${routeName}`;
                window.history.pushState(
                    { route: routeName, timestamp: Date.now() },
                    route.title,
                    url
                );
            }

            // 执行路由处理器
            await route.handler(options);

            // 更新当前路由
            this.currentRoute = route;

            // 通知导航监听器
            this.notifyNavigationListeners(route, options);

            // 执行导航后钩子
            await this.executeAfterNavigationHooks(route, options);

            // 更新页面标题
            if (typeof document !== 'undefined') {
                document.title = route.title;
            }

            this.isNavigating = false;
            return true;

        } catch (error) {
            console.error('Navigation failed:', error);
            this.isNavigating = false;
            return false;
        }
    }

    /**
     * 导航到页面内的某个区域
     * @param {string} sectionId - 区域ID
     * @param {Object} options - 导航选项
     */
    navigateToSection(sectionId, options = {}) {
        const element = document.getElementById(sectionId) || 
                       document.querySelector(`.${sectionId}`) ||
                       document.querySelector(`[data-section="${sectionId}"]`);
        
        if (element) {
            const scrollOptions = {
                behavior: options.smooth !== false ? 'smooth' : 'auto',
                block: options.block || 'start',
                inline: options.inline || 'nearest'
            };

            element.scrollIntoView(scrollOptions);

            // 添加高亮效果
            if (options.highlight !== false) {
                this.highlightElement(element, options.highlightDuration || 2000);
            }

            // 触发自定义事件
            this.dispatchNavigationEvent('section-navigate', {
                sectionId,
                element,
                options
            });
        } else {
            console.warn(`Section '${sectionId}' not found`);
        }
    }

    /**
     * 导航到外部URL
     * @param {string} url - 外部URL
     * @param {Object} options - 导航选项
     */
    navigateToExternalUrl(url, options = {}) {
        if (options.newTab !== false) {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            window.location.href = url;
        }

        // 触发自定义事件
        this.dispatchNavigationEvent('external-navigate', {
            url,
            options
        });
    }

    /**
     * 高亮元素
     * @param {HTMLElement} element - 要高亮的元素
     * @param {number} duration - 高亮持续时间
     */
    highlightElement(element, duration = 2000) {
        const originalStyle = {
            transition: element.style.transition,
            boxShadow: element.style.boxShadow,
            transform: element.style.transform
        };

        // 添加高亮样式
        element.style.transition = 'all 0.3s ease';
        element.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.6)';
        element.style.transform = 'scale(1.02)';

        // 恢复原始样式
        setTimeout(() => {
            element.style.transition = originalStyle.transition;
            element.style.boxShadow = originalStyle.boxShadow;
            element.style.transform = originalStyle.transform;
        }, duration);
    }

    /**
     * 返回上一页
     * @returns {boolean} 是否成功返回
     */
    goBack() {
        if (this.history.length > 0) {
            const previousRoute = this.history.pop();
            return this.navigateToRoute(previousRoute.name, { updateHistory: false });
        } else if (typeof window !== 'undefined' && window.history.length > 1) {
            window.history.back();
            return true;
        }
        return false;
    }

    /**
     * 前进到下一页
     */
    goForward() {
        if (typeof window !== 'undefined') {
            window.history.forward();
        }
    }

    /**
     * 刷新当前页面
     */
    refresh() {
        if (this.currentRoute) {
            this.navigateToRoute(this.currentRoute.name, { updateHistory: false });
        } else if (typeof window !== 'undefined') {
            window.location.reload();
        }
    }

    /**
     * 添加导航监听器
     * @param {Function} listener - 监听器函数
     */
    addNavigationListener(listener) {
        this.navigationListeners.add(listener);
    }

    /**
     * 移除导航监听器
     * @param {Function} listener - 监听器函数
     */
    removeNavigationListener(listener) {
        this.navigationListeners.delete(listener);
    }

    /**
     * 添加导航前钩子
     * @param {Function} hook - 钩子函数
     */
    addBeforeNavigationHook(hook) {
        this.beforeNavigationHooks.add(hook);
    }

    /**
     * 添加导航后钩子
     * @param {Function} hook - 钩子函数
     */
    addAfterNavigationHook(hook) {
        this.afterNavigationHooks.add(hook);
    }

    /**
     * 执行导航前钩子
     * @param {Object} route - 路由对象
     * @param {Object} options - 导航选项
     * @returns {Promise<boolean>} 是否允许导航
     */
    async executeBeforeNavigationHooks(route, options) {
        for (const hook of this.beforeNavigationHooks) {
            try {
                const result = await hook(route, options);
                if (result === false) {
                    return false;
                }
            } catch (error) {
                console.error('Before navigation hook failed:', error);
                return false;
            }
        }
        return true;
    }

    /**
     * 执行导航后钩子
     * @param {Object} route - 路由对象
     * @param {Object} options - 导航选项
     */
    async executeAfterNavigationHooks(route, options) {
        for (const hook of this.afterNavigationHooks) {
            try {
                await hook(route, options);
            } catch (error) {
                console.error('After navigation hook failed:', error);
            }
        }
    }

    /**
     * 通知导航监听器
     * @param {Object} route - 路由对象
     * @param {Object} options - 导航选项
     */
    notifyNavigationListeners(route, options) {
        this.navigationListeners.forEach(listener => {
            try {
                listener(route, options);
            } catch (error) {
                console.error('Navigation listener failed:', error);
            }
        });
    }

    /**
     * 触发导航事件
     * @param {string} eventType - 事件类型
     * @param {Object} detail - 事件详情
     */
    dispatchNavigationEvent(eventType, detail) {
        if (typeof window !== 'undefined' && window.CustomEvent) {
            const event = new CustomEvent(`navigation:${eventType}`, {
                detail,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * 添加到历史记录
     * @param {Object} route - 路由对象
     */
    addToHistory(route) {
        this.history.push({
            ...route,
            timestamp: Date.now()
        });

        // 保持历史记录大小在限制范围内
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * 获取导航历史
     * @param {number} limit - 返回的历史记录数量限制
     * @returns {Array} 历史记录
     */
    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }

    /**
     * 清除导航历史
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * 获取当前路由
     * @returns {Object|null} 当前路由
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * 检查是否可以返回
     * @returns {boolean} 是否可以返回
     */
    canGoBack() {
        return this.history.length > 0 || 
               (typeof window !== 'undefined' && window.history.length > 1);
    }

    /**
     * 生成导航菜单数据
     * @param {Object} options - 选项
     * @returns {Array} 菜单数据
     */
    generateMenuData(options = {}) {
        const routes = this.getAllRoutes();
        
        return routes
            .filter(route => {
                if (options.excludeExternal && route.external) return false;
                if (options.requiresAuth && route.requiresAuth && !options.isAuthenticated) return false;
                return true;
            })
            .map(route => ({
                name: route.name,
                title: route.title,
                description: route.description,
                icon: route.icon,
                external: route.external,
                active: this.currentRoute && this.currentRoute.name === route.name,
                onClick: () => this.navigateToRoute(route.name)
            }));
    }

    /**
     * 销毁导航管理器
     */
    destroy() {
        this.navigationListeners.clear();
        this.beforeNavigationHooks.clear();
        this.afterNavigationHooks.clear();
        this.routes.clear();
        this.history = [];
        this.currentRoute = null;
    }
}

// 创建全局导航管理器实例
export const navigationManager = new NavigationManager();

export default NavigationManager;