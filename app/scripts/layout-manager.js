/**
 * 全局布局管理器
 * 统一管理整体布局结构、网格系统和响应式设计
 */
export class LayoutManager {
    constructor() {
        this.breakpoints = {
            xs: 0,
            sm: 576,
            md: 768,
            lg: 992,
            xl: 1200,
            xxl: 1400
        };
        
        this.currentBreakpoint = 'lg';
        this.layoutState = {
            sidebarOpen: false,
            headerHeight: 60,
            footerHeight: 80,
            sidebarWidth: 280,
            contentPadding: 20
        };
        
        this.observers = new Set();
        this.resizeObserver = null;
        this.mediaQueries = new Map();
        
        this.init();
    }

    /**
     * 初始化布局管理器
     */
    init() {
        this.setupMediaQueries();
        this.setupResizeObserver();
        this.setupLayoutVariables();
        this.bindEvents();
        this.updateCurrentBreakpoint();
    }

    /**
     * 设置媒体查询监听
     */
    setupMediaQueries() {
        Object.entries(this.breakpoints).forEach(([name, width]) => {
            if (name === 'xs') return; // 跳过最小断点
            
            const mediaQuery = window.matchMedia(`(min-width: ${width}px)`);
            this.mediaQueries.set(name, mediaQuery);
            
            mediaQuery.addEventListener('change', () => {
                this.updateCurrentBreakpoint();
                this.handleBreakpointChange();
            });
        });
    }

    /**
     * 设置尺寸变化观察器
     */
    setupResizeObserver() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver((entries) => {
                this.handleResize(entries);
            });
            
            // 观察主要容器
            const mainElement = document.querySelector('main');
            if (mainElement) {
                this.resizeObserver.observe(mainElement);
            }
        }
    }

    /**
     * 设置CSS自定义属性
     */
    setupLayoutVariables() {
        const root = document.documentElement;
        
        // 设置断点变量
        Object.entries(this.breakpoints).forEach(([name, width]) => {
            root.style.setProperty(`--breakpoint-${name}`, `${width}px`);
        });
        
        // 设置布局变量
        root.style.setProperty('--header-height', `${this.layoutState.headerHeight}px`);
        root.style.setProperty('--footer-height', `${this.layoutState.footerHeight}px`);
        root.style.setProperty('--sidebar-width', `${this.layoutState.sidebarWidth}px`);
        root.style.setProperty('--content-padding', `${this.layoutState.contentPadding}px`);
        
        // 设置网格变量
        root.style.setProperty('--grid-columns', '12');
        root.style.setProperty('--grid-gap', '1rem');
        root.style.setProperty('--container-max-width', '1200px');
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 监听窗口大小变化
        window.addEventListener('resize', this.debounce(() => {
            this.updateCurrentBreakpoint();
            this.handleWindowResize();
        }, 250));
        
        // 监听方向变化
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateCurrentBreakpoint();
                this.handleOrientationChange();
            }, 100);
        });
        
        // 监听侧边栏切换
        document.addEventListener('sidebar:toggle', (e) => {
            this.toggleSidebar(e.detail?.force);
        });
    }

    /**
     * 更新当前断点
     */
    updateCurrentBreakpoint() {
        const width = window.innerWidth;
        let newBreakpoint = 'xs';
        
        for (const [name, minWidth] of Object.entries(this.breakpoints)) {
            if (width >= minWidth) {
                newBreakpoint = name;
            }
        }
        
        if (newBreakpoint !== this.currentBreakpoint) {
            const oldBreakpoint = this.currentBreakpoint;
            this.currentBreakpoint = newBreakpoint;
            
            // 更新CSS类
            document.body.className = document.body.className
                .replace(/breakpoint-\w+/g, '')
                .trim();
            document.body.classList.add(`breakpoint-${newBreakpoint}`);
            
            // 触发断点变化事件
            this.dispatchEvent('breakpoint:change', {
                oldBreakpoint,
                newBreakpoint,
                width
            });
        }
    }

    /**
     * 处理断点变化
     */
    handleBreakpointChange() {
        // 在小屏幕上自动关闭侧边栏
        if (this.isMobile() && this.layoutState.sidebarOpen) {
            this.setSidebarState(false);
        }
        
        // 在大屏幕上自动打开侧边栏
        if (this.isDesktop() && !this.layoutState.sidebarOpen) {
            this.setSidebarState(true);
        }
        
        // 更新内容区域布局
        this.updateContentLayout();
    }

    /**
     * 处理窗口大小变化
     */
    handleWindowResize() {
        this.updateContentLayout();
        this.notifyObservers('resize', {
            width: window.innerWidth,
            height: window.innerHeight,
            breakpoint: this.currentBreakpoint
        });
    }

    /**
     * 处理方向变化
     */
    handleOrientationChange() {
        this.updateCurrentBreakpoint();
        this.updateContentLayout();
        
        this.dispatchEvent('orientation:change', {
            orientation: screen.orientation?.angle || 0,
            breakpoint: this.currentBreakpoint
        });
    }

    /**
     * 处理尺寸观察器回调
     */
    handleResize(entries) {
        entries.forEach(entry => {
            const { width, height } = entry.contentRect;
            
            this.notifyObservers('element:resize', {
                element: entry.target,
                width,
                height
            });
        });
    }

    /**
     * 切换侧边栏状态
     */
    toggleSidebar(force) {
        const newState = force !== undefined ? force : !this.layoutState.sidebarOpen;
        this.setSidebarState(newState);
    }

    /**
     * 设置侧边栏状态
     */
    setSidebarState(isOpen) {
        this.layoutState.sidebarOpen = isOpen;
        
        // 更新CSS类
        document.body.classList.toggle('sidebar-open', isOpen);
        
        // 更新CSS变量
        const sidebarWidth = isOpen ? this.layoutState.sidebarWidth : 0;
        document.documentElement.style.setProperty('--sidebar-current-width', `${sidebarWidth}px`);
        
        // 触发事件
        this.dispatchEvent('sidebar:change', {
            isOpen,
            width: sidebarWidth
        });
        
        // 更新内容布局
        this.updateContentLayout();
    }

    /**
     * 更新内容区域布局
     */
    updateContentLayout() {
        const main = document.querySelector('main');
        if (!main) return;
        
        const sidebarWidth = this.layoutState.sidebarOpen ? this.layoutState.sidebarWidth : 0;
        const availableWidth = window.innerWidth - sidebarWidth;
        
        // 更新内容区域样式
        main.style.marginLeft = this.isMobile() ? '0' : `${sidebarWidth}px`;
        main.style.width = this.isMobile() ? '100%' : `${availableWidth}px`;
        
        // 触发布局更新事件
        this.dispatchEvent('layout:update', {
            sidebarWidth,
            availableWidth,
            breakpoint: this.currentBreakpoint
        });
    }

    /**
     * 获取网格配置
     */
    getGridConfig(columns = 12) {
        return {
            columns,
            gap: 'var(--grid-gap)',
            maxWidth: 'var(--container-max-width)',
            breakpoints: this.breakpoints
        };
    }

    /**
     * 创建响应式网格类
     */
    createGridClasses() {
        const styles = [];
        
        // 容器类
        styles.push(`
            .container {
                width: 100%;
                max-width: var(--container-max-width);
                margin: 0 auto;
                padding: 0 var(--content-padding);
            }
            
            .container-fluid {
                width: 100%;
                padding: 0 var(--content-padding);
            }
        `);
        
        // 网格系统
        styles.push(`
            .row {
                display: flex;
                flex-wrap: wrap;
                margin: 0 calc(var(--grid-gap) / -2);
            }
            
            .col {
                flex: 1;
                padding: 0 calc(var(--grid-gap) / 2);
            }
        `);
        
        // 响应式列类
        Object.entries(this.breakpoints).forEach(([breakpoint, width]) => {
            const prefix = breakpoint === 'xs' ? '' : `${breakpoint}-`;
            
            for (let i = 1; i <= 12; i++) {
                const mediaQuery = breakpoint === 'xs' ? '' : `@media (min-width: ${width}px)`;
                
                styles.push(`
                    ${mediaQuery} {
                        .col-${prefix}${i} {
                            flex: 0 0 ${(i / 12) * 100}%;
                            max-width: ${(i / 12) * 100}%;
                            padding: 0 calc(var(--grid-gap) / 2);
                        }
                        
                        .offset-${prefix}${i} {
                            margin-left: ${(i / 12) * 100}%;
                        }
                    }
                `);
            }
        });
        
        return styles.join('\n');
    }

    /**
     * 判断是否为移动设备
     */
    isMobile() {
        return this.currentBreakpoint === 'xs' || this.currentBreakpoint === 'sm';
    }

    /**
     * 判断是否为平板设备
     */
    isTablet() {
        return this.currentBreakpoint === 'md';
    }

    /**
     * 判断是否为桌面设备
     */
    isDesktop() {
        return this.currentBreakpoint === 'lg' || this.currentBreakpoint === 'xl' || this.currentBreakpoint === 'xxl';
    }

    /**
     * 获取当前断点信息
     */
    getCurrentBreakpoint() {
        return {
            name: this.currentBreakpoint,
            width: this.breakpoints[this.currentBreakpoint],
            isMobile: this.isMobile(),
            isTablet: this.isTablet(),
            isDesktop: this.isDesktop()
        };
    }

    /**
     * 添加布局观察器
     */
    addObserver(callback) {
        this.observers.add(callback);
    }

    /**
     * 移除布局观察器
     */
    removeObserver(callback) {
        this.observers.delete(callback);
    }

    /**
     * 通知所有观察器
     */
    notifyObservers(type, data) {
        this.observers.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('Layout observer error:', error);
            }
        });
    }

    /**
     * 触发自定义事件
     */
    dispatchEvent(type, detail) {
        if (typeof window !== 'undefined' && window.CustomEvent) {
            const event = new CustomEvent(`layout:${type}`, {
                detail,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }
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
     * 获取布局状态
     */
    getLayoutState() {
        return {
            ...this.layoutState,
            currentBreakpoint: this.currentBreakpoint,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight
        };
    }

    /**
     * 更新布局配置
     */
    updateLayoutConfig(config) {
        Object.assign(this.layoutState, config);
        this.setupLayoutVariables();
        this.updateContentLayout();
    }

    /**
     * 销毁布局管理器
     */
    destroy() {
        // 清理媒体查询监听器
        this.mediaQueries.forEach(mq => {
            mq.removeEventListener('change', this.handleBreakpointChange);
        });
        this.mediaQueries.clear();
        
        // 清理尺寸观察器
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // 清理观察器
        this.observers.clear();
    }
}

// 创建全局布局管理器实例
export const layoutManager = new LayoutManager();

export default LayoutManager;