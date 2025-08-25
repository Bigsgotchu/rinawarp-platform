#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

class DocumentationMonitor {
  constructor() {
    this.docsDir = path.join(__dirname, '../docs');
    this.reportsDir = path.join(__dirname, '../reports/docs');
    this.lastCheckFile = path.join(this.reportsDir, 'last-check.json');
    
    // Ensure directories exist
    fs.mkdirSync(this.reportsDir, { recursive: true });
  }

  async checkDocumentation() {
    console.log('Checking documentation status...');
    
    const report = {
      timestamp: new Date().toISOString(),
      issues: [],
      updates: [],
      recommendations: []
    };

    try {
      // Check API documentation
      this.checkApiDocs(report);
      
      // Check architecture diagrams
      this.checkArchitectureDiagrams(report);
      
      // Check runbooks
      this.checkRunbooks(report);
      
      // Check markdown files
      this.checkMarkdownFiles(report);
      
      // Generate report
      this.generateReport(report);
      
      return report;
    } catch (error) {
      console.error('Error checking documentation:', error);
      throw error;
    }
  }

  checkApiDocs(report) {
    console.log('Checking API documentation...');
    
    const apiDocsPath = path.join(__dirname, '../api/openapi.yaml');
    if (!fs.existsSync(apiDocsPath)) {
      report.issues.push('API documentation (OpenAPI spec) is missing');
      return;
    }

    try {
      const apiSpec = yaml.load(fs.readFileSync(apiDocsPath, 'utf8'));
      
      // Check for missing descriptions
      let missingDescriptions = [];
      Object.entries(apiSpec.paths || {}).forEach(([path, methods]) => {
        Object.entries(methods).forEach(([method, def]) => {
          if (!def.description) {
            missingDescriptions.push(`${method.toUpperCase()} ${path}`);
          }
        });
      });

      if (missingDescriptions.length > 0) {
        report.issues.push(
          `Missing API endpoint descriptions for: ${missingDescriptions.join(', ')}`
        );
      }

      // Check for outdated versions
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
      );
      
      if (apiSpec.info.version !== packageJson.version) {
        report.issues.push(
          `API documentation version (${apiSpec.info.version}) does not match package version (${packageJson.version})`
        );
      }
    } catch (error) {
      report.issues.push(`Error parsing API documentation: ${error.message}`);
    }
  }

  checkArchitectureDiagrams(report) {
    console.log('Checking architecture diagrams...');
    
    const diagramsDir = path.join(this.docsDir, 'diagrams');
    if (!fs.existsSync(diagramsDir)) {
      report.issues.push('Architecture diagrams directory is missing');
      return;
    }

    // Check diagram file dates
    const diagrams = fs.readdirSync(diagramsDir)
      .filter(file => file.endsWith('.png') || file.endsWith('.svg'));

    diagrams.forEach(diagram => {
      const stats = fs.statSync(path.join(diagramsDir, diagram));
      const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      
      if (ageInDays > 90) {
        report.recommendations.push(
          `Architecture diagram ${diagram} is more than 90 days old and may need review`
        );
      }
    });

    // Check for required diagrams
    const requiredDiagrams = [
      'system-architecture',
      'data-flow',
      'network-topology'
    ];

    requiredDiagrams.forEach(diagram => {
      const exists = diagrams.some(file => file.includes(diagram));
      if (!exists) {
        report.issues.push(`Missing required architecture diagram: ${diagram}`);
      }
    });
  }

  checkRunbooks(report) {
    console.log('Checking runbooks...');
    
    const runbooksDir = path.join(this.docsDir, 'runbooks');
    if (!fs.existsSync(runbooksDir)) {
      report.issues.push('Runbooks directory is missing');
      return;
    }

    const runbooks = fs.readdirSync(runbooksDir)
      .filter(file => file.endsWith('.md'));

    // Check required runbooks
    const requiredRunbooks = [
      'incident-response',
      'disaster-recovery',
      'deployment',
      'monitoring'
    ];

    requiredRunbooks.forEach(runbook => {
      const exists = runbooks.some(file => file.includes(runbook));
      if (!exists) {
        report.issues.push(`Missing required runbook: ${runbook}`);
      }
    });

    // Check runbook content
    runbooks.forEach(runbook => {
      const content = fs.readFileSync(path.join(runbooksDir, runbook), 'utf8');
      
      // Check for common sections
      const requiredSections = [
        '# Overview',
        '## Prerequisites',
        '## Steps',
        '## Verification',
        '## Rollback'
      ];

      requiredSections.forEach(section => {
        if (!content.includes(section)) {
          report.issues.push(
            `Runbook ${runbook} is missing required section: ${section}`
          );
        }
      });
    });
  }

  checkMarkdownFiles(report) {
    console.log('Checking markdown files...');
    
    const markdownFiles = this.findMarkdownFiles(this.docsDir);
    
    markdownFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for broken internal links
      const internalLinks = content.match(/\[.*?\]\((.*?)\)/g) || [];
      internalLinks.forEach(link => {
        const match = link.match(/\[.*?\]\((.*?)\)/);
        if (match) {
          const [, href] = match;
          if (href.startsWith('./') || href.startsWith('../')) {
            const targetPath = path.resolve(path.dirname(file), href);
            if (!fs.existsSync(targetPath)) {
              report.issues.push(`Broken internal link in ${file}: ${href}`);
            }
          }
        }
      });
      
      // Check for TODO comments
      const todos = content.match(/TODO:/g) || [];
      if (todos.length > 0) {
        report.issues.push(`Found ${todos.length} TODO items in ${file}`);
      }
      
      // Check for recently modified sections
      const gitLog = execSync(
        `git log -p ${file}`,
        { encoding: 'utf8' }
      );
      
      if (gitLog.includes('## Changes')) {
        report.updates.push(`Recent updates found in ${file}`);
      }
    });
  }

  findMarkdownFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        this.findMarkdownFiles(fullPath, files);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  generateReport(report) {
    const reportFile = path.join(
      this.reportsDir,
      `doc-report-${new Date().toISOString().split('T')[0]}.json`
    );
    
    // Add summary
    report.summary = {
      totalIssues: report.issues.length,
      totalUpdates: report.updates.length,
      totalRecommendations: report.recommendations.length,
      status: report.issues.length === 0 ? 'healthy' : 'needs_attention'
    };

    // Save report
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`Report generated: ${reportFile}`);

    // Update last check
    fs.writeFileSync(this.lastCheckFile, JSON.stringify({
      lastCheck: report.timestamp,
      status: report.summary.status
    }, null, 2));

    // Send alerts if needed
    if (report.issues.length > 0) {
      this.sendAlert(
        'Documentation Issues Found',
        `Found ${report.issues.length} documentation issues. Check ${reportFile} for details.`
      );
    }
  }

  sendAlert(subject, message) {
    // Implement your alert mechanism here (email, Slack, etc.)
    console.error(`ALERT - ${subject}: ${message}`);
  }
}

// Execute if run directly
if (require.main === module) {
  const monitor = new DocumentationMonitor();
  monitor.checkDocumentation()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = DocumentationMonitor;
