/**
 * Lambda@Edge function for URL rewriting and SPA routing
 * Handles single-page application routing by rewriting URLs to index.html
 */

'use strict';

exports.handler = (event, context, callback) => {
    const request = event.Records[0].cf.request;
    const uri = request.uri;
    const method = request.method;
    
    // Only process GET requests
    if (method !== 'GET') {
        callback(null, request);
        return;
    }
    
    console.log(`Processing URI: ${uri}`);
    
    // API routes - pass through unchanged
    if (uri.startsWith('/api/')) {
        callback(null, request);
        return;
    }
    
    // Health check routes - pass through unchanged
    if (uri.startsWith('/health/')) {
        callback(null, request);
        return;
    }
    
    // Static assets - pass through unchanged
    const staticFileExtensions = [
        '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
        '.woff', '.woff2', '.ttf', '.eot', '.otf',
        '.pdf', '.zip', '.txt', '.xml', '.json', '.map'
    ];
    
    const hasStaticExtension = staticFileExtensions.some(ext => uri.toLowerCase().endsWith(ext));
    if (hasStaticExtension) {
        callback(null, request);
        return;
    }
    
    // Static directory - pass through unchanged
    if (uri.startsWith('/static/') || uri.startsWith('/assets/')) {
        callback(null, request);
        return;
    }
    
    // Special files that should be served directly
    const specialFiles = [
        '/manifest.json',
        '/robots.txt',
        '/sitemap.xml',
        '/favicon.ico',
        '/service-worker.js',
        '/sw.js',
        '/.well-known/apple-app-site-association',
        '/.well-known/assetlinks.json'
    ];
    
    if (specialFiles.includes(uri)) {
        callback(null, request);
        return;
    }
    
    // Directory-like URLs - ensure they end with /
    if (uri.match(/^\/[^.]*[^\/]$/)) {
        // Check if this looks like a directory (no file extension)
        const segments = uri.split('/');
        const lastSegment = segments[segments.length - 1];
        
        // If last segment doesn't contain a dot, it's likely a directory
        if (!lastSegment.includes('.')) {
            // Redirect to add trailing slash
            const response = {
                status: '301',
                statusDescription: 'Moved Permanently',
                headers: {
                    location: [{
                        key: 'Location',
                        value: uri + '/'
                    }],
                    'cache-control': [{
                        key: 'Cache-Control',
                        value: 'max-age=3600'  // Cache redirects for 1 hour
                    }]
                }
            };
            callback(null, response);
            return;
        }
    }
    
    // Root path - serve index.html
    if (uri === '/' || uri === '/index.html') {
        request.uri = '/index.html';
        callback(null, request);
        return;
    }
    
    // SPA routes - rewrite to index.html for client-side routing
    // Common SPA route patterns
    const spaRoutePatterns = [
        /^\/dashboard($|\/.*)/,
        /^\/profile($|\/.*)/,
        /^\/settings($|\/.*)/,
        /^\/chat($|\/.*)/,
        /^\/discovery($|\/.*)/,
        /^\/search($|\/.*)/,
        /^\/auth($|\/.*)/,
        /^\/login($|\/.*)/,
        /^\/register($|\/.*)/,
        /^\/forgot-password($|\/.*)/,
        /^\/reset-password($|\/.*)/,
        /^\/verify($|\/.*)/
    ];
    
    const isSpaRoute = spaRoutePatterns.some(pattern => pattern.test(uri));
    
    if (isSpaRoute || (uri.match(/^\/[^.]*\/?$/) && !uri.startsWith('/api/'))) {
        console.log(`Rewriting SPA route ${uri} to /index.html`);
        request.uri = '/index.html';
        
        // Add original URI as header for analytics/debugging
        request.headers['x-original-uri'] = [{
            key: 'X-Original-URI',
            value: uri
        }];
    }
    
    // Handle deep links with query parameters
    if (request.querystring) {
        console.log(`Query parameters present: ${request.querystring}`);
        // Keep query string for SPA to handle
    }
    
    // Handle hash fragments (client-side routing)
    // Note: CloudFront strips hash fragments, so we can't process them here
    // The client-side router will handle them
    
    console.log(`Final URI: ${request.uri}`);
    callback(null, request);
};