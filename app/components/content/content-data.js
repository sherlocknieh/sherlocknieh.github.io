// Content Data Manager - 内容数据管理模块
export class ContentDataManager {
    constructor() {
        this.data = {
            hero: {
                title: '欢迎来到我的个人网站',
                subtitle: '这里是我分享技术、记录成长的地方'
            },
            features: [
                {
                    icon: '📝',
                    title: '技术博客',
                    description: '分享前端开发经验和技术心得',
                    link: '/blog'
                },
                {
                    icon: '💼',
                    title: '项目展示',
                    description: '展示个人项目和开源贡献',
                    link: '/projects'
                },
                {
                    icon: '🎨',
                    title: '设计作品',
                    description: 'UI/UX 设计和创意作品集',
                    link: '/design'
                },
                {
                    icon: '📚',
                    title: '学习笔记',
                    description: '记录学习过程和知识总结',
                    link: '/notes'
                }
            ],
            stats: [
                { number: '50+', label: '技术文章' },
                { number: '20+', label: '开源项目' },
                { number: '5+', label: '年经验' },
                { number: '1000+', label: '代码提交' }
            ]
        };
        
        this.subscribers = new Set();
        this.cache = new Map();
    }
    
    // 订阅数据变化
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }
    
    // 通知订阅者
    notify(type, data) {
        this.subscribers.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('Error in data subscriber:', error);
            }
        });
    }
    
    // 获取所有数据
    getData() {
        return { ...this.data };
    }
    
    // 更新英雄区域数据
    updateHero(heroData) {
        this.data.hero = { ...this.data.hero, ...heroData };
        this.notify('hero', this.data.hero);
    }
    
    // 更新功能特性数据
    updateFeatures(features) {
        this.data.features = features;
        this.notify('features', this.data.features);
    }
    
    // 更新统计数据
    updateStats(stats) {
        this.data.stats = stats;
        this.notify('stats', this.data.stats);
    }
    
    // 从API加载数据
    async loadFromAPI(endpoint) {
        const cacheKey = `api-${endpoint}`;
        
        // 检查缓存
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5分钟缓存
                return cached.data;
            }
        }
        
        try {
            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 缓存数据
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            // 更新本地数据
            this.mergeData(data);
            
            return data;
        } catch (error) {
            console.error('Failed to load data from API:', error);
            throw error;
        }
    }
    
    // 合并数据
    mergeData(newData) {
        if (newData.hero) {
            this.updateHero(newData.hero);
        }
        if (newData.features) {
            this.updateFeatures(newData.features);
        }
        if (newData.stats) {
            this.updateStats(newData.stats);
        }
    }
    
    // 模拟动态数据更新
    startDynamicUpdates() {
        // 模拟统计数据的实时更新
        setInterval(() => {
            const stats = [...this.data.stats];
            stats.forEach(stat => {
                if (stat.label === '代码提交') {
                    const current = parseInt(stat.number);
                    stat.number = `${current + Math.floor(Math.random() * 3)}+`;
                }
            });
            this.updateStats(stats);
        }, 30000); // 每30秒更新一次
    }
    
    // 获取个性化内容
    getPersonalizedContent(userPreferences = {}) {
        const data = this.getData();
        
        // 根据用户偏好调整内容
        if (userPreferences.theme === 'dark') {
            data.hero.title = '🌙 ' + data.hero.title;
        }
        
        if (userPreferences.language === 'en') {
            data.hero.title = 'Welcome to My Personal Website';
            data.hero.subtitle = 'Where I share technology and record growth';
        }
        
        return data;
    }
    
    // 清理缓存
    clearCache() {
        this.cache.clear();
    }
    
    // 导出数据
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }
    
    // 导入数据
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            this.mergeData(data);
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }
}

// 单例实例
export const contentDataManager = new ContentDataManager();
export default contentDataManager;