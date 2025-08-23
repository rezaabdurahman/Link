#!/usr/bin/env node

/**
 * Test Dashboard Generator
 * Generates a comprehensive HTML dashboard from test results
 */

const fs = require('fs');
const path = require('path');

class TestDashboard {
  constructor() {
    this.results = {
      jest: null,
      cypress: [],
      lighthouse: null,
      accessibility: null,
      coverage: null,
    };
  }

  async generateDashboard() {
    console.log('📊 Generating test dashboard...');
    
    // Load test results
    await this.loadJestResults();
    await this.loadCypressResults();
    await this.loadLighthouseResults();
    await this.loadAccessibilityResults();
    await this.loadCoverageResults();
    
    // Generate HTML
    const html = this.generateHTML();
    
    // Write dashboard
    const outputPath = path.join(process.cwd(), 'test-dashboard.html');
    fs.writeFileSync(outputPath, html);
    
    console.log(`✅ Dashboard generated: ${outputPath}`);
    
    // Generate summary stats
    this.generateSummaryStats();
  }

  async loadJestResults() {
    const jestPath = path.join(process.cwd(), 'test-results', 'jest-results.xml');
    if (fs.existsSync(jestPath)) {
      try {
        const content = fs.readFileSync(jestPath, 'utf8');
        const testsuiteMatch = content.match(/testsuite.*?tests="(\d+)".*?failures="(\d+)".*?skipped="(\d+)"/);
        if (testsuiteMatch) {
          this.results.jest = {
            total: parseInt(testsuiteMatch[1]),
            failures: parseInt(testsuiteMatch[2]),
            skipped: parseInt(testsuiteMatch[3]),
            passed: parseInt(testsuiteMatch[1]) - parseInt(testsuiteMatch[2]) - parseInt(testsuiteMatch[3])
          };
        }
      } catch (error) {
        console.warn('⚠️ Could not parse Jest results:', error.message);
      }
    }
  }

  async loadCypressResults() {
    const cypressDir = path.join(process.cwd(), 'cypress', 'results');
    if (fs.existsSync(cypressDir)) {
      const files = fs.readdirSync(cypressDir).filter(f => f.endsWith('.xml'));
      
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(cypressDir, file), 'utf8');
          const testsuiteMatch = content.match(/testsuite.*?tests="(\d+)".*?failures="(\d+)".*?skipped="(\d+)"/);
          if (testsuiteMatch) {
            this.results.cypress.push({
              name: file.replace('.xml', ''),
              total: parseInt(testsuiteMatch[1]),
              failures: parseInt(testsuiteMatch[2]),
              skipped: parseInt(testsuiteMatch[3]),
              passed: parseInt(testsuiteMatch[1]) - parseInt(testsuiteMatch[2]) - parseInt(testsuiteMatch[3])
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not parse Cypress results for ${file}:`, error.message);
        }
      }
    }
  }

  async loadLighthouseResults() {
    const lhciDir = path.join(process.cwd(), '.lighthouseci');
    if (fs.existsSync(lhciDir)) {
      try {
        const manifestPath = path.join(lhciDir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const latestRun = manifest[0]; // Get the latest run
          if (latestRun && latestRun.summary) {
            this.results.lighthouse = {
              performance: latestRun.summary.performance,
              accessibility: latestRun.summary.accessibility,
              bestPractices: latestRun.summary['best-practices'],
              seo: latestRun.summary.seo,
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not parse Lighthouse results:', error.message);
      }
    }
  }

  async loadAccessibilityResults() {
    const axePath = path.join(process.cwd(), 'axe-results.json');
    if (fs.existsSync(axePath)) {
      try {
        const axeResults = JSON.parse(fs.readFileSync(axePath, 'utf8'));
        this.results.accessibility = {
          violations: axeResults.violations ? axeResults.violations.length : 0,
          passes: axeResults.passes ? axeResults.passes.length : 0,
          incomplete: axeResults.incomplete ? axeResults.incomplete.length : 0,
          inapplicable: axeResults.inapplicable ? axeResults.inapplicable.length : 0,
        };
      } catch (error) {
        console.warn('⚠️ Could not parse accessibility results:', error.message);
      }
    }
  }

  async loadCoverageResults() {
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    if (fs.existsSync(coveragePath)) {
      try {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        this.results.coverage = {
          lines: Math.round(coverage.total.lines.pct),
          functions: Math.round(coverage.total.functions.pct),
          branches: Math.round(coverage.total.branches.pct),
          statements: Math.round(coverage.total.statements.pct),
        };
      } catch (error) {
        console.warn('⚠️ Could not parse coverage results:', error.message);
      }
    }
  }

  generateHTML() {
    const timestamp = new Date().toISOString();
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Frontend - Test Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #334155; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; text-align: center; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { opacity: 0.9; font-size: 1.1rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .card { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
        .card h2 { color: #1e293b; margin-bottom: 1rem; font-size: 1.3rem; display: flex; align-items: center; gap: 0.5rem; }
        .metric { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; }
        .metric:last-child { border-bottom: none; }
        .metric-label { font-weight: 500; }
        .metric-value { font-weight: 700; font-size: 1.1rem; }
        .status-success { color: #059669; }
        .status-warning { color: #d97706; }
        .status-error { color: #dc2626; }
        .progress-bar { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 0.5rem; }
        .progress-fill { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
        .progress-success { background: #10b981; }
        .progress-warning { background: #f59e0b; }
        .progress-error { background: #ef4444; }
        .icon { font-size: 1.2rem; }
        .footer { text-align: center; padding: 2rem; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 2rem; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .summary-card { background: white; padding: 1.5rem; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .summary-card h3 { font-size: 2rem; margin-bottom: 0.5rem; }
        .summary-card p { color: #64748b; font-weight: 500; }
        @media (max-width: 768px) { .container { padding: 1rem; } .grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Dashboard</h1>
            <p>Link Frontend - Comprehensive Test Results</p>
            <p>Generated: ${timestamp}</p>
        </div>

        ${this.generateSummarySection()}
        ${this.generateTestResultsSection()}
        
        <div class="footer">
            <p>Dashboard generated by Link CI/CD Pipeline</p>
        </div>
    </div>
</body>
</html>`;
  }

  generateSummarySection() {
    const totalTests = this.getTotalTests();
    const passedTests = this.getPassedTests();
    const failedTests = this.getFailedTests();
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    return `
        <div class="summary-grid">
            <div class="summary-card">
                <h3 class="status-success">${totalTests}</h3>
                <p>Total Tests</p>
            </div>
            <div class="summary-card">
                <h3 class="status-success">${passedTests}</h3>
                <p>Passed</p>
            </div>
            <div class="summary-card">
                <h3 class="${failedTests > 0 ? 'status-error' : 'status-success'}">${failedTests}</h3>
                <p>Failed</p>
            </div>
            <div class="summary-card">
                <h3 class="${successRate >= 90 ? 'status-success' : successRate >= 70 ? 'status-warning' : 'status-error'}">${successRate}%</h3>
                <p>Success Rate</p>
            </div>
        </div>`;
  }

  generateTestResultsSection() {
    return `
        <div class="grid">
            ${this.generateJestCard()}
            ${this.generateCypressCard()}
            ${this.generateCoverageCard()}
            ${this.generateLighthouseCard()}
            ${this.generateAccessibilityCard()}
        </div>`;
  }

  generateJestCard() {
    if (!this.results.jest) {
      return `
            <div class="card">
                <h2><span class="icon">🧪</span> Unit Tests</h2>
                <p>No Jest results found</p>
            </div>`;
    }

    const { total, passed, failures, skipped } = this.results.jest;
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    return `
            <div class="card">
                <h2><span class="icon">🧪</span> Unit Tests</h2>
                <div class="metric">
                    <span class="metric-label">Total Tests</span>
                    <span class="metric-value">${total}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Passed</span>
                    <span class="metric-value status-success">${passed}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Failed</span>
                    <span class="metric-value ${failures > 0 ? 'status-error' : 'status-success'}">${failures}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Skipped</span>
                    <span class="metric-value status-warning">${skipped}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Success Rate</span>
                    <span class="metric-value ${successRate >= 90 ? 'status-success' : successRate >= 70 ? 'status-warning' : 'status-error'}">${successRate}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${successRate >= 90 ? 'progress-success' : successRate >= 70 ? 'progress-warning' : 'progress-error'}" style="width: ${successRate}%"></div>
                </div>
            </div>`;
  }

  generateCypressCard() {
    if (this.results.cypress.length === 0) {
      return `
            <div class="card">
                <h2><span class="icon">🎭</span> E2E Tests</h2>
                <p>No Cypress results found</p>
            </div>`;
    }

    const totals = this.results.cypress.reduce((acc, result) => ({
      total: acc.total + result.total,
      passed: acc.passed + result.passed,
      failures: acc.failures + result.failures,
      skipped: acc.skipped + result.skipped,
    }), { total: 0, passed: 0, failures: 0, skipped: 0 });

    const successRate = totals.total > 0 ? Math.round((totals.passed / totals.total) * 100) : 0;

    return `
            <div class="card">
                <h2><span class="icon">🎭</span> E2E Tests</h2>
                <div class="metric">
                    <span class="metric-label">Total Tests</span>
                    <span class="metric-value">${totals.total}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Passed</span>
                    <span class="metric-value status-success">${totals.passed}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Failed</span>
                    <span class="metric-value ${totals.failures > 0 ? 'status-error' : 'status-success'}">${totals.failures}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Success Rate</span>
                    <span class="metric-value ${successRate >= 90 ? 'status-success' : successRate >= 70 ? 'status-warning' : 'status-error'}">${successRate}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${successRate >= 90 ? 'progress-success' : successRate >= 70 ? 'progress-warning' : 'progress-error'}" style="width: ${successRate}%"></div>
                </div>
            </div>`;
  }

  generateCoverageCard() {
    if (!this.results.coverage) {
      return `
            <div class="card">
                <h2><span class="icon">📊</span> Code Coverage</h2>
                <p>No coverage results found</p>
            </div>`;
    }

    const { lines, functions, branches, statements } = this.results.coverage;

    return `
            <div class="card">
                <h2><span class="icon">📊</span> Code Coverage</h2>
                <div class="metric">
                    <span class="metric-label">Lines</span>
                    <span class="metric-value ${lines >= 60 ? 'status-success' : lines >= 40 ? 'status-warning' : 'status-error'}">${lines}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Functions</span>
                    <span class="metric-value ${functions >= 60 ? 'status-success' : functions >= 40 ? 'status-warning' : 'status-error'}">${functions}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Branches</span>
                    <span class="metric-value ${branches >= 60 ? 'status-success' : branches >= 40 ? 'status-warning' : 'status-error'}">${branches}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Statements</span>
                    <span class="metric-value ${statements >= 60 ? 'status-success' : statements >= 40 ? 'status-warning' : 'status-error'}">${statements}%</span>
                </div>
            </div>`;
  }

  generateLighthouseCard() {
    if (!this.results.lighthouse) {
      return `
            <div class="card">
                <h2><span class="icon">💡</span> Performance</h2>
                <p>No Lighthouse results found</p>
            </div>`;
    }

    const { performance, accessibility, bestPractices, seo } = this.results.lighthouse;

    return `
            <div class="card">
                <h2><span class="icon">💡</span> Lighthouse Scores</h2>
                <div class="metric">
                    <span class="metric-label">Performance</span>
                    <span class="metric-value ${performance >= 90 ? 'status-success' : performance >= 70 ? 'status-warning' : 'status-error'}">${performance}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Accessibility</span>
                    <span class="metric-value ${accessibility >= 90 ? 'status-success' : accessibility >= 70 ? 'status-warning' : 'status-error'}">${accessibility}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Best Practices</span>
                    <span class="metric-value ${bestPractices >= 90 ? 'status-success' : bestPractices >= 70 ? 'status-warning' : 'status-error'}">${bestPractices}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">SEO</span>
                    <span class="metric-value ${seo >= 90 ? 'status-success' : seo >= 70 ? 'status-warning' : 'status-error'}">${seo}</span>
                </div>
            </div>`;
  }

  generateAccessibilityCard() {
    if (!this.results.accessibility) {
      return `
            <div class="card">
                <h2><span class="icon">♿</span> Accessibility</h2>
                <p>No accessibility results found</p>
            </div>`;
    }

    const { violations, passes, incomplete, inapplicable } = this.results.accessibility;

    return `
            <div class="card">
                <h2><span class="icon">♿</span> Accessibility</h2>
                <div class="metric">
                    <span class="metric-label">Violations</span>
                    <span class="metric-value ${violations === 0 ? 'status-success' : 'status-error'}">${violations}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Passes</span>
                    <span class="metric-value status-success">${passes}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Incomplete</span>
                    <span class="metric-value status-warning">${incomplete}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Inapplicable</span>
                    <span class="metric-value">${inapplicable}</span>
                </div>
            </div>`;
  }

  getTotalTests() {
    let total = 0;
    if (this.results.jest) total += this.results.jest.total;
    if (this.results.cypress.length > 0) {
      total += this.results.cypress.reduce((acc, result) => acc + result.total, 0);
    }
    return total;
  }

  getPassedTests() {
    let passed = 0;
    if (this.results.jest) passed += this.results.jest.passed;
    if (this.results.cypress.length > 0) {
      passed += this.results.cypress.reduce((acc, result) => acc + result.passed, 0);
    }
    return passed;
  }

  getFailedTests() {
    let failed = 0;
    if (this.results.jest) failed += this.results.jest.failures;
    if (this.results.cypress.length > 0) {
      failed += this.results.cypress.reduce((acc, result) => acc + result.failures, 0);
    }
    return failed;
  }

  generateSummaryStats() {
    const stats = {
      totalTests: this.getTotalTests(),
      passedTests: this.getPassedTests(),
      failedTests: this.getFailedTests(),
      successRate: this.getTotalTests() > 0 ? Math.round((this.getPassedTests() / this.getTotalTests()) * 100) : 0,
      coverage: this.results.coverage ? this.results.coverage.lines : null,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync('test-stats.json', JSON.stringify(stats, null, 2));
    console.log('📈 Test statistics saved to test-stats.json');
  }
}

// Run if called directly
if (require.main === module) {
  const dashboard = new TestDashboard();
  dashboard.generateDashboard().catch(console.error);
}

module.exports = TestDashboard;