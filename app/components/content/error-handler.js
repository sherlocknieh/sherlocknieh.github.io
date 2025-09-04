/**
 * 错误处理工具类
 * 提供统一的错误处理、日志记录和用户反馈机制
 */
export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.retryAttempts = new Map();
        this.maxRetries = 3;
    }

    /**
     * 处理错误并返回用户友好的错误信息
     * @param {Error} error - 错误对象
     * @param {string} context - 错误上下文
     * @param {Object} options - 处理选项
     * @returns {Object} 处理结果
     */
    handleError(error, context = 'Unknown', options = {}) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            context,
            message: error.message,
            stack: error.stack,
            type: error.constructor.name,
            severity: options.severity || 'error',
            recoverable: options.recoverable !== false
        };

        // 记录错误日志
        this.logError(errorInfo);

        // 根据错误类型返回相应的处理结果
        return this.categorizeError(error, context, options);
    }

    /**
     * 记录错误日志
     * @param {Object} errorInfo - 错误信息
     */
    logError(errorInfo) {
        this.errorLog.push(errorInfo);
        
        // 保持日志大小在限制范围内
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // 在开发环境下输出详细错误信息
        if (process.env.NODE_ENV === 'development') {
            console.group(`🚨 Error in ${errorInfo.context}`);
            console.error('Message:', errorInfo.message);
            console.error('Type:', errorInfo.type);
            console.error('Stack:', errorInfo.stack);
            console.groupEnd();
        }
    }

    /**
     * 根据错误类型分类处理
     * @param {Error} error - 错误对象
     * @param {string} context - 错误上下文
     * @param {Object} options - 处理选项
     * @returns {Object} 处理结果
     */
    categorizeError(error, context, options) {
        // 网络错误
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return this.handleNetworkError(error, context, options);
        }

        // 解析错误
        if (error instanceof SyntaxError) {
            return this.handleParseError(error, context, options);
        }

        // 资源加载错误
        if (error.message.includes('404') || error.message.includes('not found')) {
            return this.handleResourceError(error, context, options);
        }

        // 权限错误
        if (error.message.includes('403') || error.message.includes('unauthorized')) {
            return this.handlePermissionError(error, context, options);
        }

        // 通用错误
        return this.handleGenericError(error, context, options);
    }

    /**
     * 处理网络错误
     */
    handleNetworkError(error, context, options) {
        return {
            type: 'network',
            title: '网络连接错误',
            message: '无法连接到服务器，请检查网络连接后重试',
            icon: '🌐',
            recoverable: true,
            retryable: true,
            suggestions: [
                '检查网络连接',
                '稍后重试',
                '联系技术支持'
            ]
        };
    }

    /**
     * 处理解析错误
     */
    handleParseError(error, context, options) {
        return {
            type: 'parse',
            title: '数据解析错误',
            message: '服务器返回的数据格式有误，请稍后重试',
            icon: '📄',
            recoverable: true,
            retryable: true,
            suggestions: [
                '刷新页面',
                '清除浏览器缓存',
                '联系技术支持'
            ]
        };
    }

    /**
     * 处理资源加载错误
     */
    handleResourceError(error, context, options) {
        return {
            type: 'resource',
            title: '资源加载失败',
            message: '请求的资源不存在或已被移动',
            icon: '📁',
            recoverable: false,
            retryable: false,
            suggestions: [
                '检查URL是否正确',
                '联系管理员',
                '返回首页'
            ]
        };
    }

    /**
     * 处理权限错误
     */
    handlePermissionError(error, context, options) {
        return {
            type: 'permission',
            title: '访问权限不足',
            message: '您没有权限访问此资源',
            icon: '🔒',
            recoverable: false,
            retryable: false,
            suggestions: [
                '检查登录状态',
                '联系管理员获取权限',
                '返回首页'
            ]
        };
    }

    /**
     * 处理通用错误
     */
    handleGenericError(error, context, options) {
        return {
            type: 'generic',
            title: '操作失败',
            message: '发生了未知错误，请稍后重试',
            icon: '⚠️',
            recoverable: true,
            retryable: true,
            suggestions: [
                '刷新页面',
                '稍后重试',
                '联系技术支持'
            ]
        };
    }

    /**
     * 检查是否可以重试
     * @param {string} context - 错误上下文
     * @returns {boolean} 是否可以重试
     */
    canRetry(context) {
        const attempts = this.retryAttempts.get(context) || 0;
        return attempts < this.maxRetries;
    }

    /**
     * 增加重试次数
     * @param {string} context - 错误上下文
     */
    incrementRetry(context) {
        const attempts = this.retryAttempts.get(context) || 0;
        this.retryAttempts.set(context, attempts + 1);
    }

    /**
     * 重置重试次数
     * @param {string} context - 错误上下文
     */
    resetRetry(context) {
        this.retryAttempts.delete(context);
    }

    /**
     * 创建错误重试函数
     * @param {Function} operation - 要重试的操作
     * @param {string} context - 操作上下文
     * @param {Object} options - 重试选项
     * @returns {Function} 重试函数
     */
    createRetryFunction(operation, context, options = {}) {
        const { delay = 1000, backoff = 2 } = options;
        
        return async () => {
            if (!this.canRetry(context)) {
                throw new Error(`Maximum retry attempts (${this.maxRetries}) exceeded for ${context}`);
            }

            this.incrementRetry(context);
            const attempts = this.retryAttempts.get(context);
            const retryDelay = delay * Math.pow(backoff, attempts - 1);

            // 等待指定时间后重试
            await new Promise(resolve => setTimeout(resolve, retryDelay));

            try {
                const result = await operation();
                this.resetRetry(context); // 成功后重置重试次数
                return result;
            } catch (error) {
                // 如果还能重试，抛出错误让上层处理
                if (this.canRetry(context)) {
                    throw error;
                } else {
                    // 达到最大重试次数，重置并抛出最终错误
                    this.resetRetry(context);
                    throw new Error(`Operation failed after ${this.maxRetries} attempts: ${error.message}`);
                }
            }
        };
    }

    /**
     * 获取错误日志
     * @param {Object} filters - 过滤条件
     * @returns {Array} 过滤后的错误日志
     */
    getErrorLog(filters = {}) {
        let logs = [...this.errorLog];

        if (filters.context) {
            logs = logs.filter(log => log.context.includes(filters.context));
        }

        if (filters.severity) {
            logs = logs.filter(log => log.severity === filters.severity);
        }

        if (filters.type) {
            logs = logs.filter(log => log.type === filters.type);
        }

        if (filters.since) {
            const since = new Date(filters.since);
            logs = logs.filter(log => new Date(log.timestamp) >= since);
        }

        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * 清除错误日志
     */
    clearErrorLog() {
        this.errorLog = [];
        this.retryAttempts.clear();
    }

    /**
     * 导出错误日志
     * @param {string} format - 导出格式 ('json' | 'csv')
     * @returns {string} 导出的数据
     */
    exportErrorLog(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.errorLog, null, 2);
        }

        if (format === 'csv') {
            const headers = ['Timestamp', 'Context', 'Type', 'Severity', 'Message'];
            const rows = this.errorLog.map(log => [
                log.timestamp,
                log.context,
                log.type,
                log.severity,
                `"${log.message.replace(/"/g, '""')}"`
            ]);
            
            return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        }

        throw new Error(`Unsupported export format: ${format}`);
    }
}

// 创建全局错误处理器实例
export const errorHandler = new ErrorHandler();

// 全局错误监听器
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        errorHandler.handleError(event.error, 'Global Error', {
            severity: 'critical',
            recoverable: false
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        errorHandler.handleError(event.reason, 'Unhandled Promise Rejection', {
            severity: 'critical',
            recoverable: false
        });
    });
}

export default ErrorHandler;