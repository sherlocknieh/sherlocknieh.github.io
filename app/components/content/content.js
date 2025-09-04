// Content Component - 主要内容区域组件
import { contentDataManager } from './content-data.js';
import { errorHandler } from './error-handler.js';
import { performanceMonitor } from './performance-monitor.js';
import { navigationManager } from './navigation-manager.js';

export class AppContent extends HTMLElement {
    // 静态缓存用于存储模板
    static templateCache = new Map();
    static observerInstance = null;
    
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isLoaded = false;
        this.loadingState = 'idle'; // idle, loading, loaded, error
        this.dataSubscription = null;
        this.componentId = `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // 开始性能监控
        performanceMonitor.startMeasure(`${this.componentId}-init`, {
            component: 'AppContent',
            type: 'initialization'
        });
        
        // 初始化懒加载
        this.initLazyLoading();
        
        // 订阅数据变化
        this.subscribeToData();
        
        // 结束初始化性能监控
        performanceMonitor.endMeasure(`${this.componentId}-init`);
    }
    
    // 懒加载初始化
    initLazyLoading() {
        if (!AppContent.observerInstance) {
            AppContent.observerInstance = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting && !entry.target.isLoaded) {
                            entry.target.loadTemplate();
                        }
                    });
                },
                { threshold: 0.1 }
            );
        }
        
        AppContent.observerInstance.observe(this);
    }

    async loadTemplate() {
        if (this.isLoaded || this.loadingState === 'loading') {
            return;
        }
        
        const loadId = `${this.componentId}-load`;
        performanceMonitor.startMeasure(loadId, {
            component: 'AppContent',
            type: 'template-load'
        });
        
        this.loadingState = 'loading';
        this.showLoadingState();
        
        try {
            // 检查缓存
            const cacheKey = 'content-template';
            let templateData = AppContent.templateCache.get(cacheKey);
            
            if (!templateData) {
                // 获取当前模块的基础路径
                const baseUrl = new URL('.', import.meta.url);
                
                // 并行加载 HTML 和 CSS
                const [htmlResponse, cssResponse] = await Promise.all([
                    fetch(new URL('./content.html', baseUrl)),
                    fetch(new URL('./content.css', baseUrl))
                ]);
                
                if (!htmlResponse.ok || !cssResponse.ok) {
                    throw new Error('Failed to fetch template files');
                }
                
                const [htmlContent, cssContent] = await Promise.all([
                    htmlResponse.text(),
                    cssResponse.text()
                ]);
                
                templateData = { html: htmlContent, css: cssContent };
                // 缓存模板数据
                AppContent.templateCache.set(cacheKey, templateData);
                performanceMonitor.endMeasure(loadId, { fromCache: false });
            } else {
                performanceMonitor.endMeasure(loadId, { fromCache: true });
            }
            
            // 渲染组件
            await this.renderTemplate(templateData);
            this.loadingState = 'loaded';
            this.isLoaded = true;
            
        } catch (error) {
            performanceMonitor.endMeasure(loadId, { success: false, error: error.message });
            const errorInfo = errorHandler.handleError(error, 'AppContent.loadTemplate', {
                severity: 'high',
                recoverable: true
            });
            this.loadingState = 'error';
            // 降级到内联模板
            this.renderFallback(errorInfo);
        }
    }
    
    // 显示加载状态
    showLoadingState() {
        this.shadowRoot.innerHTML = `
            <style>
                .loading-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 200px;
                    flex-direction: column;
                    gap: 1rem;
                }
                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .loading-text {
                    color: #666;
                    font-size: 1rem;
                }
            </style>
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">正在加载内容...</div>
            </div>
        `;
    }
    
    // 渲染模板
    async renderTemplate(templateData) {
        const renderId = `${this.componentId}-render`;
        performanceMonitor.startMeasure(renderId, {
            component: 'AppContent',
            type: 'template-render'
        });
        
        try {
            // 获取当前数据
            const currentData = contentDataManager.getData();
            
            // 处理模板中的数据绑定
            let processedHtml = this.bindData(templateData.html, currentData);
            
            // 添加淡入动画
            this.shadowRoot.innerHTML = `
                <style>
                    ${templateData.css}
                    .app-content {
                        opacity: 0;
                        animation: fadeIn 0.5s ease-in-out forwards;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                </style>
                ${processedHtml}
            `;
            
            // 初始化交互功能
            await this.initInteractions();
            
            // 开始性能监控
            const contentElement = this.shadowRoot.querySelector('.app-content');
            if (contentElement) {
                performanceMonitor.observeRender(contentElement, this.componentId);
                performanceMonitor.observeInteraction(contentElement, 'click', this.componentId);
            }
            
            performanceMonitor.endMeasure(renderId, { success: true });
            
        } catch (error) {
            performanceMonitor.endMeasure(renderId, { success: false, error: error.message });
            const errorInfo = errorHandler.handleError(error, 'AppContent.renderTemplate', {
                severity: 'high',
                recoverable: true
            });
            this.renderFallback(errorInfo);
        }
    }
    
    // 数据绑定处理
    bindData(html, data) {
        let processedHtml = html;
        
        // 绑定英雄区域数据
        if (data.hero) {
            processedHtml = processedHtml.replace(
                /<h1 class="hero-title">[^<]*<\/h1>/,
                `<h1 class="hero-title">${data.hero.title}</h1>`
            );
            processedHtml = processedHtml.replace(
                /<p class="hero-subtitle">[^<]*<\/p>/,
                `<p class="hero-subtitle">${data.hero.subtitle}</p>`
            );
        }
        
        // 绑定功能特性数据
        if (data.features && data.features.length > 0) {
            const featuresHtml = data.features.map(feature => `
                <div class="feature-card" data-link="${feature.link}">
                    <div class="feature-icon">${feature.icon}</div>
                    <h3 class="feature-title">${feature.title}</h3>
                    <p class="feature-description">${feature.description}</p>
                </div>
            `).join('');
            
            processedHtml = processedHtml.replace(
                /<div class="features-grid">.*?<\/div>/s,
                `<div class="features-grid">${featuresHtml}</div>`
            );
        }
        
        // 绑定统计数据
        if (data.stats && data.stats.length > 0) {
            const statsHtml = data.stats.map(stat => `
                <div class="stat-item">
                    <div class="stat-number">${stat.number}</div>
                    <div class="stat-label">${stat.label}</div>
                </div>
            `).join('');
            
            processedHtml = processedHtml.replace(
                /<div class="stats-grid">.*?<\/div>/s,
                `<div class="stats-grid">${statsHtml}</div>`
            );
        }
        
        return processedHtml;
    }
    
    // 订阅数据变化
    subscribeToData() {
        this.dataSubscription = contentDataManager.subscribe((type, data) => {
            if (!this.isLoaded) return;
            
            switch (type) {
                case 'hero':
                    this.updateHeroSection(data);
                    break;
                case 'features':
                    this.updateFeaturesSection(data);
                    break;
                case 'stats':
                    this.updateStatsSection(data);
                    break;
            }
        });
    }
    
    // 更新英雄区域
    updateHeroSection(heroData) {
        const heroTitle = this.shadowRoot.querySelector('.hero-title');
        const heroSubtitle = this.shadowRoot.querySelector('.hero-subtitle');
        
        if (heroTitle && heroData.title) {
            this.animateTextChange(heroTitle, heroData.title);
        }
        if (heroSubtitle && heroData.subtitle) {
            this.animateTextChange(heroSubtitle, heroData.subtitle);
        }
    }
    
    // 更新功能特性区域
    updateFeaturesSection(features) {
        const featuresGrid = this.shadowRoot.querySelector('.features-grid');
        if (!featuresGrid) return;
        
        // 淡出效果
        featuresGrid.style.opacity = '0';
        
        setTimeout(() => {
            featuresGrid.innerHTML = features.map(feature => `
                <div class="feature-card" data-link="${feature.link}">
                    <div class="feature-icon">${feature.icon}</div>
                    <h3 class="feature-title">${feature.title}</h3>
                    <p class="feature-description">${feature.description}</p>
                </div>
            `).join('');
            
            // 重新绑定事件
            this.bindFeatureCardEvents();
            
            // 淡入效果
            featuresGrid.style.opacity = '1';
        }, 300);
    }
    
    // 更新统计区域
    updateStatsSection(stats) {
        const statItems = this.shadowRoot.querySelectorAll('.stat-item');
        
        stats.forEach((stat, index) => {
            if (statItems[index]) {
                const number = statItems[index].querySelector('.stat-number');
                const label = statItems[index].querySelector('.stat-label');
                
                if (number && stat.number !== number.textContent) {
                    this.animateNumberChange(number, stat.number);
                }
                if (label && stat.label !== label.textContent) {
                    label.textContent = stat.label;
                }
            }
        });
    }
    
    // 文本变化动画
    animateTextChange(element, newText) {
        element.style.transition = 'opacity 0.3s ease';
        element.style.opacity = '0';
        
        setTimeout(() => {
            element.textContent = newText;
            element.style.opacity = '1';
        }, 300);
    }
    
    // 数字变化动画
    animateNumberChange(element, newNumber) {
        const currentNumber = parseInt(element.textContent) || 0;
        const targetNumber = parseInt(newNumber) || 0;
        const suffix = newNumber.replace(/\d+/g, '');
        
        if (currentNumber === targetNumber) return;
        
        this.animateNumber(element, currentNumber, targetNumber, 1000, suffix);
    }
    
    renderFallback(errorInfo) {
        // 如果errorInfo是Error对象，使用errorHandler处理
        if (errorInfo instanceof Error) {
            errorInfo = errorHandler.handleError(errorInfo, 'AppContent.renderFallback');
        }
        
        const canRetry = errorHandler.canRetry('AppContent.loadTemplate');
        const retryButton = canRetry 
            ? `<button class="retry-btn" onclick="this.getRootNode().host.handleRetry()">重试</button>`
            : `<button class="retry-btn" onclick="window.location.reload()">刷新页面</button>`;
        
        // 如果外部文件加载失败，使用内联模板作为降级方案
        this.shadowRoot.innerHTML = `
            <style>
                .app-content {
                    margin-left: 300px;
                    margin-top: 80px;
                    min-height: calc(100vh - 80px);
                    background: #f5f7fa;
                    padding: 2rem;
                    transition: margin-left 0.3s ease;
                }
                .app-content.sidebar-closed {
                    margin-left: 0;
                }
                .error-container {
                    text-align: center;
                    padding: 4rem 2rem;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .error-title {
                    color: #e74c3c;
                    font-size: 1.5rem;
                    margin-bottom: 1rem;
                }
                .error-message {
                    color: #666;
                    margin-bottom: 2rem;
                    max-width: 400px;
                    margin-left: auto;
                    margin-right: auto;
                }
                .error-suggestions {
                    list-style: none;
                    padding: 0;
                    margin: 1rem 0;
                    color: #666;
                    font-size: 0.9rem;
                }
                .error-suggestions li {
                    margin: 0.5rem 0;
                }
                .retry-btn {
                    background: #e74c3c;
                    color: white;
                    border: none;
                    padding: 0.8rem 2rem;
                    border-radius: 25px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }
                .retry-btn:hover {
                    background: #c82333;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(220, 53, 69, 0.4);
                }
            </style>
            <main class="app-content" id="mainContent">
                <div class="error-container">
                    <h2 class="error-title">${errorInfo.icon || '⚠️'} ${errorInfo.title || '内容加载失败'}</h2>
                    <p class="error-message">${errorInfo.message || '无法加载页面内容，请检查网络连接或稍后重试。'}</p>
                    ${errorInfo.suggestions ? `
                        <ul class="error-suggestions">
                            ${errorInfo.suggestions.map(suggestion => `<li>• ${suggestion}</li>`).join('')}
                        </ul>
                    ` : ''}
                    ${retryButton}
                </div>
            </main>
        `;
    }
    
    // 初始化交互功能
    async initInteractions() {
        // 为按钮添加点击事件
        const buttons = this.shadowRoot.querySelectorAll('.btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', this.handleButtonClick.bind(this));
        });
        
        // 为功能卡片添加点击事件
        this.bindFeatureCardEvents();
        
        // 绑定导航事件
        this.bindNavigationEvents();
        
        // 添加统计数字动画
        this.animateStats();
        
        // 启动动态数据更新
        contentDataManager.startDynamicUpdates();
    }
    
    // 绑定功能卡片事件
    bindFeatureCardEvents() {
        const featureCards = this.shadowRoot.querySelectorAll('.feature-card');
        featureCards.forEach(card => {
            card.addEventListener('click', this.handleFeatureClick.bind(this));
        });
    }
    
    // 绑定导航相关事件
    bindNavigationEvents() {
        // 绑定按钮点击事件
        this.bindButtonEvents();
        
        // 绑定导航监听器
        this.setupNavigationListeners();
        
        // 绑定键盘导航
        this.bindKeyboardNavigation();
    }
    
    // 绑定按钮点击事件
    bindButtonEvents() {
        const buttons = this.shadowRoot.querySelectorAll('.btn, .cta-button, .nav-button');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = button.dataset.action;
                const route = button.dataset.route;
                const url = button.dataset.url;
                const section = button.dataset.section;
                
                this.handleButtonClick(action, route, url, section, e);
            });
        });
    }
    
    // 设置导航监听器
    setupNavigationListeners() {
        // 监听导航事件
        navigationManager.addNavigationListener((route, options) => {
            this.onNavigationChange(route, options);
        });

        // 监听自定义导航事件
        document.addEventListener('navigation:section-navigate', (e) => {
            this.onSectionNavigate(e.detail);
        });

        document.addEventListener('navigation:external-navigate', (e) => {
            this.onExternalNavigate(e.detail);
        });
    }
    
    // 绑定键盘导航
    bindKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Alt + 数字键快速导航
            if (e.altKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const routeIndex = parseInt(e.key) - 1;
                const routes = navigationManager.getAllRoutes();
                if (routes[routeIndex]) {
                    navigationManager.navigateToRoute(routes[routeIndex].name);
                }
            }
            
            // Alt + 左箭头返回
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                navigationManager.goBack();
            }
            
            // Alt + 右箭头前进
            if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                navigationManager.goForward();
            }
        });
    }
    
    // 处理按钮点击
    handleButtonClick(action, route, url, section, event) {
        event.preventDefault();
        
        // 记录用户交互
        performanceMonitor.recordCustomMetric('button_click', {
            action,
            route,
            url,
            section,
            timestamp: Date.now()
        });
        
        // 添加点击动画效果
        this.addClickAnimation(event.target);
        
        // 根据不同类型执行相应操作
        if (action) {
            this.executeAction(action, { route, url, section });
        } else if (route) {
            navigationManager.navigateToRoute(route);
        } else if (url) {
            navigationManager.navigateToExternalUrl(url);
        } else if (section) {
            navigationManager.navigateToSection(section);
        }
        
        // 触发自定义事件
        this.dispatchEvent(new CustomEvent('button-click', {
            detail: { action, route, url, section },
            bubbles: true
        }));
    }
    
    // 执行特定动作
    executeAction(action, params) {
        switch (action) {
            case 'download-resume':
                this.downloadResume();
                break;
            case 'contact-me':
                navigationManager.navigateToRoute('contact');
                break;
            case 'view-projects':
                navigationManager.navigateToRoute('projects');
                break;
            case 'learn-more':
                navigationManager.navigateToRoute('about');
                break;
            case 'scroll-to-top':
                window.scrollTo({ top: 0, behavior: 'smooth' });
                break;
            case 'toggle-theme':
                this.toggleTheme();
                break;
            case 'share-page':
                this.sharePage();
                break;
            case 'print-page':
                window.print();
                break;
            default:
                console.warn(`Unknown action: ${action}`);
        }
    }
    
    // 下载简历
    downloadResume() {
        const resumeUrl = '/assets/resume.pdf';
        const link = document.createElement('a');
        link.href = resumeUrl;
        link.download = 'resume.pdf';
        link.click();
        
        // 记录下载事件
        performanceMonitor.recordCustomMetric('resume_download', {
            timestamp: Date.now()
        });
    }
    
    // 切换主题
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // 触发主题变更事件
        this.dispatchEvent(new CustomEvent('theme-change', {
            detail: { oldTheme: currentTheme, newTheme },
            bubbles: true
        }));
    }
    
    // 分享页面
    async sharePage() {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: document.title,
                    text: '查看我的个人网站',
                    url: window.location.href
                });
            } catch (error) {
                console.log('分享取消或失败:', error);
            }
        } else {
            // 降级到复制链接
            try {
                await navigator.clipboard.writeText(window.location.href);
                this.showToast('链接已复制到剪贴板');
            } catch (error) {
                console.error('复制链接失败:', error);
            }
        }
    }
    
    // 添加点击动画效果
    addClickAnimation(element) {
        element.style.transform = 'scale(0.95)';
        element.style.transition = 'transform 0.1s ease';
        
        setTimeout(() => {
            element.style.transform = '';
        }, 100);
    }
    
    // 显示提示消息
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color, #667eea);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
    
    // 处理功能卡片点击
    handleFeatureClick(event) {
        const card = event.currentTarget;
        const title = card.querySelector('.feature-title').textContent;
        const link = card.dataset.link;
        const route = card.dataset.route;
        
        // 记录用户交互
        performanceMonitor.recordCustomMetric('feature_card_click', {
            title,
            link,
            route,
            timestamp: Date.now()
        });
        
        // 添加点击动画
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.style.transform = '';
        }, 150);
        
        if (route) {
            // 使用路由导航
            navigationManager.navigateToRoute(route);
        } else if (link) {
            // 使用链接导航
            if (link.startsWith('http')) {
                navigationManager.navigateToExternalUrl(link);
            } else if (link.startsWith('#')) {
                const sectionId = link.substring(1);
                navigationManager.navigateToSection(sectionId);
            } else {
                navigationManager.navigateToExternalUrl(link, { newTab: false });
            }
        }
        
        // 触发自定义事件
        this.dispatchEvent(new CustomEvent('feature-click', {
            detail: { title, link, route },
            bubbles: true
        }));
    }
    
    // 导航变更回调
    onNavigationChange(route, options) {
        // 更新活跃状态
        this.updateActiveStates(route);
        
        // 记录导航事件
        performanceMonitor.recordCustomMetric('navigation_change', {
            routeName: route.name,
            routeTitle: route.title,
            timestamp: Date.now()
        });
    }
    
    // 区域导航回调
    onSectionNavigate(detail) {
        console.log('Section navigated:', detail.sectionId);
    }
    
    // 外部导航回调
    onExternalNavigate(detail) {
        console.log('External navigation:', detail.url);
    }
    
    // 更新活跃状态
    updateActiveStates(route) {
        // 移除所有活跃状态
        const activeElements = this.shadowRoot.querySelectorAll('.active');
        activeElements.forEach(el => el.classList.remove('active'));
        
        // 添加当前路由的活跃状态
        const currentElements = this.shadowRoot.querySelectorAll(`[data-route="${route.name}"]`);
        currentElements.forEach(el => el.classList.add('active'));
    }
    
    // 统计数字动画
    animateStats() {
        const statNumbers = this.shadowRoot.querySelectorAll('.stat-number');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    const finalValue = parseInt(target.textContent);
                    this.animateNumber(target, 0, finalValue, 2000);
                    observer.unobserve(target);
                }
            });
        });
        
        statNumbers.forEach(stat => observer.observe(stat));
    }
    
    // 数字动画函数
    animateNumber(element, start, end, duration, suffix = '') {
        const startTime = performance.now();
        if (!suffix) {
            suffix = element.textContent.replace(/\d+/g, '');
        }
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.floor(start + (end - start) * this.easeOutCubic(progress));
            element.textContent = current + suffix;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // 缓动函数
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    // 切换侧边栏状态
    toggleSidebarState(isOpen) {
        const content = this.shadowRoot.querySelector('.app-content');
        if (content) {
            content.classList.toggle('sidebar-closed', !isOpen);
        }
    }
    
    // 更新内容数据（外部API）
    updateContent(data) {
        if (!this.isLoaded) return;
        
        // 通过数据管理器更新数据
        contentDataManager.mergeData(data);
    }
    
    // 加载外部数据
    async loadExternalData(endpoint) {
        const loadId = `${this.componentId}-external-data`;
        performanceMonitor.startMeasure(loadId, {
            component: 'AppContent',
            type: 'external-data-load',
            endpoint
        });
        
        try {
            const data = await contentDataManager.loadFromAPI(endpoint);
            console.log('External data loaded successfully:', data);
            
            performanceMonitor.endMeasure(loadId, { success: true, dataSize: JSON.stringify(data).length });
            return data;
        } catch (error) {
            performanceMonitor.endMeasure(loadId, { success: false, error: error.message });
            const errorInfo = errorHandler.handleError(error, 'AppContent.loadExternalData', {
                severity: 'medium',
                recoverable: true
            });
            // 显示错误提示
            this.showDataLoadError(errorInfo);
            throw error;
        }
    }
    
    // 显示数据加载错误
    showDataLoadError(errorInfo) {
        // 如果errorInfo是Error对象，使用errorHandler处理
        if (errorInfo instanceof Error) {
            errorInfo = errorHandler.handleError(errorInfo, 'AppContent.showDataLoadError');
        }
        
        const errorElement = document.createElement('div');
        errorElement.className = 'data-load-error';
        errorElement.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${errorInfo.type === 'network' ? '#e74c3c' : '#ffa726'};
                color: white;
                padding: 1rem;
                border-radius: 10px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.2);
                z-index: 1000;
                max-width: 350px;
                animation: slideInRight 0.3s ease;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-size: 1.2rem; margin-right: 0.5rem;">${errorInfo.icon || '⚠️'}</span>
                    <strong>${errorInfo.title || '数据加载失败'}</strong>
                    <button onclick="this.closest('.data-load-error').remove()" style="
                        background: none;
                        border: none;
                        color: white;
                        margin-left: auto;
                        cursor: pointer;
                        font-size: 1.2rem;
                        padding: 0;
                        width: 20px;
                        height: 20px;
                    ">×</button>
                </div>
                <div style="font-size: 0.9rem; opacity: 0.9;">
                    ${errorInfo.message || '数据加载失败，正在使用缓存数据'}
                </div>
                ${errorInfo.retryable ? `
                    <button onclick="this.closest('app-content').handleDataRetry(); this.closest('.data-load-error').remove();" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        color: white;
                        padding: 0.3rem 0.8rem;
                        border-radius: 15px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        margin-top: 0.5rem;
                    ">重试</button>
                ` : ''}
            </div>
            <style>
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            </style>
        `;
        
        document.body.appendChild(errorElement);
        
        // 8秒后自动移除
        setTimeout(() => {
            if (errorElement.parentElement) {
                errorElement.style.animation = 'slideInRight 0.3s ease reverse';
                setTimeout(() => errorElement.remove(), 300);
            }
        }, 8000);
    }
    
    // 获取个性化内容
    getPersonalizedContent(preferences) {
        return contentDataManager.getPersonalizedContent(preferences);
    }
    
    handleRetry() {
        if (errorHandler.canRetry('AppContent.loadTemplate')) {
            const retryFn = errorHandler.createRetryFunction(
                () => this.loadTemplate(),
                'AppContent.loadTemplate',
                { delay: 1000, backoff: 1.5 }
            );
            retryFn().catch(error => {
                console.error('Retry failed:', error);
            });
        } else {
            window.location.reload();
        }
    }
    
    handleDataRetry() {
        if (errorHandler.canRetry('AppContent.loadExternalData')) {
            // 重新启动动态更新
            contentDataManager.startDynamicUpdates();
        }
    }
    
    // 组件销毁时清理
    disconnectedCallback() {
        if (AppContent.observerInstance) {
            AppContent.observerInstance.unobserve(this);
        }
        
        // 取消数据订阅
        if (this.dataSubscription) {
            this.dataSubscription();
        }
        
        // 清理性能监控
        performanceMonitor.cleanup();
        
        // 重置错误重试计数
        errorHandler.resetRetry('AppContent.loadTemplate');
        errorHandler.resetRetry('AppContent.loadExternalData');
    }
}

export default AppContent;