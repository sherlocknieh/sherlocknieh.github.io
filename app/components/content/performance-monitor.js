/**
 * 性能监控工具类
 * 监控组件加载时间、渲染性能和用户交互响应时间
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.observers = new Map();
        this.thresholds = {
            loadTime: 2000,      // 2秒
            renderTime: 100,     // 100毫秒
            interactionTime: 50, // 50毫秒
            memoryUsage: 50      // 50MB
        };
        this.isEnabled = true;
        this.reportCallback = null;
    }

    /**
     * 启用性能监控
     */
    enable() {
        this.isEnabled = true;
    }

    /**
     * 禁用性能监控
     */
    disable() {
        this.isEnabled = false;
    }

    /**
     * 设置性能阈值
     * @param {Object} thresholds - 性能阈值配置
     */
    setThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * 设置性能报告回调函数
     * @param {Function} callback - 回调函数
     */
    setReportCallback(callback) {
        this.reportCallback = callback;
    }

    /**
     * 开始性能测量
     * @param {string} name - 测量名称
     * @param {Object} metadata - 元数据
     */
    startMeasure(name, metadata = {}) {
        if (!this.isEnabled) return;

        const startTime = performance.now();
        const memoryInfo = this.getMemoryInfo();
        
        this.metrics.set(name, {
            startTime,
            startMemory: memoryInfo,
            metadata,
            status: 'running'
        });

        // 使用 Performance API 标记
        if (performance.mark) {
            performance.mark(`${name}-start`);
        }
    }

    /**
     * 结束性能测量
     * @param {string} name - 测量名称
     * @param {Object} additionalData - 额外数据
     * @returns {Object} 性能指标
     */
    endMeasure(name, additionalData = {}) {
        if (!this.isEnabled || !this.metrics.has(name)) return null;

        const endTime = performance.now();
        const endMemory = this.getMemoryInfo();
        const startData = this.metrics.get(name);
        
        const duration = endTime - startData.startTime;
        const memoryDelta = endMemory.usedJSHeapSize - startData.startMemory.usedJSHeapSize;

        const metric = {
            name,
            duration,
            startTime: startData.startTime,
            endTime,
            memoryDelta,
            startMemory: startData.startMemory,
            endMemory,
            metadata: startData.metadata,
            additionalData,
            timestamp: new Date().toISOString(),
            status: 'completed'
        };

        // 使用 Performance API 测量
        if (performance.mark && performance.measure) {
            performance.mark(`${name}-end`);
            try {
                performance.measure(name, `${name}-start`, `${name}-end`);
            } catch (e) {
                console.warn('Performance measure failed:', e);
            }
        }

        // 检查性能阈值
        this.checkThresholds(metric);

        // 更新指标
        this.metrics.set(name, metric);

        // 触发报告回调
        if (this.reportCallback) {
            this.reportCallback(metric);
        }

        return metric;
    }

    /**
     * 测量函数执行时间
     * @param {string} name - 测量名称
     * @param {Function} fn - 要测量的函数
     * @param {Object} metadata - 元数据
     * @returns {Promise} 函数执行结果
     */
    async measureFunction(name, fn, metadata = {}) {
        this.startMeasure(name, metadata);
        
        try {
            const result = await fn();
            this.endMeasure(name, { success: true });
            return result;
        } catch (error) {
            this.endMeasure(name, { success: false, error: error.message });
            throw error;
        }
    }

    /**
     * 监控DOM渲染性能
     * @param {HTMLElement} element - 要监控的元素
     * @param {string} name - 监控名称
     */
    observeRender(element, name) {
        if (!this.isEnabled || !window.ResizeObserver) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const renderTime = performance.now();
                this.recordMetric(`${name}-render`, {
                    timestamp: renderTime,
                    contentRect: entry.contentRect,
                    target: entry.target.tagName
                });
            }
        });

        observer.observe(element);
        this.observers.set(name, observer);
    }

    /**
     * 监控用户交互性能
     * @param {HTMLElement} element - 要监控的元素
     * @param {string} eventType - 事件类型
     * @param {string} name - 监控名称
     */
    observeInteraction(element, eventType, name) {
        if (!this.isEnabled) return;

        const handler = (event) => {
            const startTime = performance.now();
            
            // 使用 requestIdleCallback 或 setTimeout 来测量处理时间
            const measureCallback = () => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                this.recordMetric(`${name}-interaction`, {
                    eventType,
                    duration,
                    timestamp: startTime,
                    target: event.target.tagName,
                    isThresholdExceeded: duration > this.thresholds.interactionTime
                });
            };

            if (window.requestIdleCallback) {
                requestIdleCallback(measureCallback);
            } else {
                setTimeout(measureCallback, 0);
            }
        };

        element.addEventListener(eventType, handler, { passive: true });
        
        // 存储处理器以便后续清理
        if (!this.observers.has(`${name}-${eventType}`)) {
            this.observers.set(`${name}-${eventType}`, {
                element,
                eventType,
                handler
            });
        }
    }

    /**
     * 记录自定义指标
     * @param {string} name - 指标名称
     * @param {Object} data - 指标数据
     */
    recordMetric(name, data) {
        if (!this.isEnabled) return;

        const metric = {
            name,
            timestamp: new Date().toISOString(),
            ...data
        };

        // 如果已存在同名指标，转换为数组
        const existing = this.metrics.get(name);
        if (existing) {
            if (Array.isArray(existing)) {
                existing.push(metric);
            } else {
                this.metrics.set(name, [existing, metric]);
            }
        } else {
            this.metrics.set(name, metric);
        }
    }

    /**
     * 检查性能阈值
     * @param {Object} metric - 性能指标
     */
    checkThresholds(metric) {
        const warnings = [];

        // 检查加载时间
        if (metric.name.includes('load') && metric.duration > this.thresholds.loadTime) {
            warnings.push(`Load time exceeded threshold: ${metric.duration}ms > ${this.thresholds.loadTime}ms`);
        }

        // 检查渲染时间
        if (metric.name.includes('render') && metric.duration > this.thresholds.renderTime) {
            warnings.push(`Render time exceeded threshold: ${metric.duration}ms > ${this.thresholds.renderTime}ms`);
        }

        // 检查内存使用
        if (metric.memoryDelta > this.thresholds.memoryUsage * 1024 * 1024) {
            warnings.push(`Memory usage exceeded threshold: ${(metric.memoryDelta / 1024 / 1024).toFixed(2)}MB > ${this.thresholds.memoryUsage}MB`);
        }

        if (warnings.length > 0) {
            console.warn(`Performance warnings for ${metric.name}:`, warnings);
            metric.warnings = warnings;
        }
    }

    /**
     * 获取内存信息
     * @returns {Object} 内存信息
     */
    getMemoryInfo() {
        if (performance.memory) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
        return { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
    }

    /**
     * 获取页面加载性能指标
     * @returns {Object} 页面性能指标
     */
    getPagePerformance() {
        if (!performance.timing) return null;

        const timing = performance.timing;
        const navigation = performance.navigation;

        return {
            // 页面加载时间
            pageLoadTime: timing.loadEventEnd - timing.navigationStart,
            // DOM解析时间
            domParseTime: timing.domContentLoadedEventEnd - timing.domLoading,
            // 资源加载时间
            resourceLoadTime: timing.loadEventEnd - timing.domContentLoadedEventEnd,
            // 首字节时间
            timeToFirstByte: timing.responseStart - timing.navigationStart,
            // DNS查询时间
            dnsLookupTime: timing.domainLookupEnd - timing.domainLookupStart,
            // TCP连接时间
            tcpConnectTime: timing.connectEnd - timing.connectStart,
            // 导航类型
            navigationType: navigation.type,
            // 重定向次数
            redirectCount: navigation.redirectCount
        };
    }

    /**
     * 获取所有性能指标
     * @param {Object} filters - 过滤条件
     * @returns {Array} 性能指标列表
     */
    getMetrics(filters = {}) {
        let metrics = Array.from(this.metrics.entries()).map(([name, data]) => ({
            name,
            ...(Array.isArray(data) ? { measurements: data } : data)
        }));

        if (filters.name) {
            metrics = metrics.filter(metric => metric.name.includes(filters.name));
        }

        if (filters.minDuration) {
            metrics = metrics.filter(metric => 
                metric.duration && metric.duration >= filters.minDuration
            );
        }

        if (filters.hasWarnings) {
            metrics = metrics.filter(metric => metric.warnings && metric.warnings.length > 0);
        }

        return metrics;
    }

    /**
     * 生成性能报告
     * @returns {Object} 性能报告
     */
    generateReport() {
        const metrics = this.getMetrics();
        const pagePerf = this.getPagePerformance();
        const memoryInfo = this.getMemoryInfo();

        // 计算统计信息
        const loadMetrics = metrics.filter(m => m.name.includes('load'));
        const renderMetrics = metrics.filter(m => m.name.includes('render'));
        const interactionMetrics = metrics.filter(m => m.name.includes('interaction'));

        const avgLoadTime = loadMetrics.length > 0 
            ? loadMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / loadMetrics.length 
            : 0;

        const avgRenderTime = renderMetrics.length > 0
            ? renderMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / renderMetrics.length
            : 0;

        return {
            timestamp: new Date().toISOString(),
            summary: {
                totalMetrics: metrics.length,
                avgLoadTime: Math.round(avgLoadTime),
                avgRenderTime: Math.round(avgRenderTime),
                memoryUsage: Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024),
                warningCount: metrics.filter(m => m.warnings).length
            },
            pagePerformance: pagePerf,
            currentMemory: memoryInfo,
            thresholds: this.thresholds,
            metrics: metrics.slice(-20) // 最近20个指标
        };
    }

    /**
     * 清理观察器和指标
     */
    cleanup() {
        // 清理ResizeObserver
        this.observers.forEach((observer, name) => {
            if (observer.disconnect) {
                observer.disconnect();
            } else if (observer.element && observer.handler) {
                observer.element.removeEventListener(observer.eventType, observer.handler);
            }
        });
        
        this.observers.clear();
        this.metrics.clear();
    }

    /**
     * 导出性能数据
     * @param {string} format - 导出格式
     * @returns {string} 导出的数据
     */
    exportData(format = 'json') {
        const report = this.generateReport();
        
        if (format === 'json') {
            return JSON.stringify(report, null, 2);
        }
        
        if (format === 'csv') {
            const headers = ['Name', 'Duration', 'Memory Delta', 'Timestamp', 'Status'];
            const rows = report.metrics.map(metric => [
                metric.name,
                metric.duration || 'N/A',
                metric.memoryDelta || 'N/A',
                metric.timestamp,
                metric.status || 'N/A'
            ]);
            
            return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        }
        
        throw new Error(`Unsupported export format: ${format}`);
    }
}

// 创建全局性能监控器实例
export const performanceMonitor = new PerformanceMonitor();

export default PerformanceMonitor;