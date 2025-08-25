/**
 * Lambda@Edge function for adding security headers to CloudFront responses
 * Environment: ${environment}
 * Domain: ${domain_name}
 */

'use strict';

exports.handler = (event, context, callback) => {
    const response = event.Records[0].cf.response;
    const headers = response.headers;
    const request = event.Records[0].cf.request;
    
    // Environment-specific configuration
    const isProduction = '${environment}' === 'production';
    const domain = '${domain_name}';
    
    // Security Headers
    
    // Strict Transport Security - Force HTTPS
    headers['strict-transport-security'] = [{
        key: 'Strict-Transport-Security',
        value: isProduction 
            ? 'max-age=31536000; includeSubDomains; preload'
            : 'max-age=300; includeSubDomains'  // Shorter for non-production
    }];
    
    // Content Security Policy - Prevent XSS
    const cspValue = isProduction 
        ? `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.${domain} wss://*.${domain}; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`
        : `default-src 'self' 'unsafe-eval' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' https:; connect-src 'self' https: wss: ws:; media-src 'self' blob:; frame-ancestors 'none';`;
    
    headers['content-security-policy'] = [{
        key: 'Content-Security-Policy',
        value: cspValue
    }];
    
    // Prevent MIME type sniffing
    headers['x-content-type-options'] = [{
        key: 'X-Content-Type-Options',
        value: 'nosniff'
    }];
    
    // Prevent clickjacking
    headers['x-frame-options'] = [{
        key: 'X-Frame-Options',
        value: 'DENY'
    }];
    
    // XSS Protection (legacy browsers)
    headers['x-xss-protection'] = [{
        key: 'X-XSS-Protection',
        value: '1; mode=block'
    }];
    
    // Referrer Policy
    headers['referrer-policy'] = [{
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
    }];
    
    // Permissions Policy (Feature Policy)
    headers['permissions-policy'] = [{
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    }];
    
    // Cross-Origin Embedder Policy (for advanced security)
    if (isProduction) {
        headers['cross-origin-embedder-policy'] = [{
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
        }];
        
        headers['cross-origin-opener-policy'] = [{
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
        }];
    }
    
    // Service Worker security (if applicable)
    if (request.uri === '/service-worker.js') {
        headers['service-worker-allowed'] = [{
            key: 'Service-Worker-Allowed',
            value: '/'
        }];
    }
    
    // Cache control for security headers
    const uri = request.uri;
    if (uri.endsWith('.html') || uri === '/' || uri.endsWith('/')) {
        // Don't cache HTML files with security headers
        headers['cache-control'] = [{
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
        }];
        
        headers['pragma'] = [{
            key: 'Pragma',
            value: 'no-cache'
        }];
        
        headers['expires'] = [{
            key: 'Expires',
            value: '0'
        }];
    }
    
    // Add environment information (non-production only)
    if (!isProduction) {
        headers['x-environment'] = [{
            key: 'X-Environment',
            value: '${environment}'
        }];
    }
    
    // Add Lambda@Edge processing timestamp
    headers['x-edge-processed'] = [{
        key: 'X-Edge-Processed',
        value: new Date().toISOString()
    }];
    
    // Performance hints
    if (isProduction && (uri === '/' || uri.endsWith('.html'))) {
        // Preload critical resources
        headers['link'] = [{
            key: 'Link',
            value: '</static/css/main.css>; rel=preload; as=style, </static/js/main.js>; rel=preload; as=script'
        }];
    }
    
    callback(null, response);
};