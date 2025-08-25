#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class TaskDependencyTracker {
  constructor() {
    this.tasksFile = path.join(__dirname, '../config/tasks.yml');
    this.historyDir = path.join(__dirname, '../reports/tasks');
    this.dependencyFile = path.join(__dirname, '../config/dependencies.yml');
    this.graphFile = path.join(__dirname, '../reports/dependencies/task-graph.json');
  }

  async analyzeDependencies() {
    console.log('Analyzing task dependencies...');

    try {
      // Load task definitions
      const tasks = await this.loadTasks();
      
      // Build dependency graph
      const graph = this.buildDependencyGraph(tasks);
      
      // Analyze execution history
      const history = await this.analyzeExecutionHistory();
      
      // Check for circular dependencies
      const circularDeps = this.findCircularDependencies(graph);
      
      // Calculate success rates
      const successRates = await this.calculateSuccessRates();
      
      // Generate report
      const report = this.generateReport({
        graph,
        history,
        circularDeps,
        successRates
      });

      await this.saveReport(report);
      
      // Check for issues
      const issues = this.checkForIssues(report);
      if (issues.length > 0) {
        await this.notifyIssues(issues);
      }

      return report;
    } catch (error) {
      console.error('Error analyzing dependencies:', error);
      throw error;
    }
  }

  async loadTasks() {
    const taskConfig = yaml.load(fs.readFileSync(this.tasksFile, 'utf8'));
    const dependencies = fs.existsSync(this.dependencyFile) ?
      yaml.load(fs.readFileSync(this.dependencyFile, 'utf8')) : {};

    return {
      tasks: taskConfig.tasks,
      dependencies
    };
  }

  buildDependencyGraph(taskData) {
    const graph = {
      nodes: [],
      edges: [],
      metadata: {}
    };

    // Add nodes (tasks)
    taskData.tasks.forEach(task => {
      graph.nodes.push({
        id: task.name,
        type: task.type,
        schedule: task.schedule,
        metadata: {
          command: task.command,
          notify: task.notify,
          environment: task.environment
        }
      });
    });

    // Add edges (dependencies)
    Object.entries(taskData.dependencies || {}).forEach(([taskName, deps]) => {
      deps.forEach(dep => {
        graph.edges.push({
          from: taskName,
          to: dep.task,
          type: dep.type || 'requires',
          metadata: dep.metadata || {}
        });
      });
    });

    return graph;
  }

  async analyzeExecutionHistory() {
    const history = {
      executions: {},
      patterns: {},
      issues: []
    };

    // Read all task execution reports
    const files = await fs.promises.readdir(this.historyDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const report = JSON.parse(
        await fs.promises.readFile(
          path.join(this.historyDir, file),
          'utf8'
        )
      );

      this.processExecutionReport(report, history);
    }

    return history;
  }

  processExecutionReport(report, history) {
    const taskName = report.taskName;
    if (!history.executions[taskName]) {
      history.executions[taskName] = {
        total: 0,
        success: 0,
        failure: 0,
        durations: [],
        lastExecution: null
      };
    }

    const execution = history.executions[taskName];
    execution.total++;
    if (report.execution.status === 'success') {
      execution.success++;
    } else {
      execution.failure++;
    }

    execution.durations.push(report.execution.duration);
    execution.lastExecution = report.execution.timestamp;

    // Analyze patterns
    this.analyzeExecutionPatterns(taskName, report, history);
  }

  analyzeExecutionPatterns(taskName, report, history) {
    if (!history.patterns[taskName]) {
      history.patterns[taskName] = {
        timeOfDay: {},
        dayOfWeek: {},
        failures: {},
        performance: []
      };
    }

    const patterns = history.patterns[taskName];
    const date = new Date(report.execution.timestamp);
    
    // Time of day pattern
    const hour = date.getHours();
    patterns.timeOfDay[hour] = (patterns.timeOfDay[hour] || 0) + 1;

    // Day of week pattern
    const day = date.getDay();
    patterns.dayOfWeek[day] = (patterns.dayOfWeek[day] || 0) + 1;

    // Failure patterns
    if (report.execution.status === 'failure') {
      const error = report.execution.error || 'unknown';
      patterns.failures[error] = (patterns.failures[error] || 0) + 1;
    }

    // Performance pattern
    patterns.performance.push({
      timestamp: report.execution.timestamp,
      duration: report.execution.duration
    });
  }

  findCircularDependencies(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    const circular = [];

    function dfs(node, path = []) {
      if (recursionStack.has(node)) {
        const cycle = path.slice(path.indexOf(node));
        circular.push(cycle);
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const edges = graph.edges.filter(e => e.from === node);
      for (const edge of edges) {
        dfs(edge.to, [...path]);
      }

      recursionStack.delete(node);
    }

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    });

    return circular;
  }

  async calculateSuccessRates() {
    const rates = {};
    const files = await fs.promises.readdir(this.historyDir);
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const report = JSON.parse(
        await fs.promises.readFile(
          path.join(this.historyDir, file),
          'utf8'
        )
      );

      const taskName = report.taskName;
      if (!rates[taskName]) {
        rates[taskName] = {
          total: 0,
          success: 0
        };
      }

      rates[taskName].total++;
      if (report.execution.status === 'success') {
        rates[taskName].success++;
      }
    }

    // Calculate percentages
    Object.values(rates).forEach(rate => {
      rate.percentage = (rate.success / rate.total) * 100;
    });

    return rates;
  }

  generateReport(data) {
    return {
      timestamp: new Date().toISOString(),
      dependencyGraph: data.graph,
      executionHistory: data.history,
      circularDependencies: data.circularDeps,
      successRates: data.successRates,
      analysis: {
        riskFactors: this.analyzeRiskFactors(data),
        recommendations: this.generateRecommendations(data),
        optimizations: this.suggestOptimizations(data)
      }
    };
  }

  analyzeRiskFactors(data) {
    const risks = [];

    // Check for circular dependencies
    if (data.circularDeps.length > 0) {
      risks.push({
        type: 'circular_dependency',
        severity: 'high',
        details: `Found ${data.circularDeps.length} circular dependencies`
      });
    }

    // Check for low success rates
    Object.entries(data.successRates).forEach(([task, rate]) => {
      if (rate.percentage < 90) {
        risks.push({
          type: 'low_success_rate',
          severity: rate.percentage < 80 ? 'high' : 'medium',
          details: `Task ${task} has ${rate.percentage.toFixed(1)}% success rate`
        });
      }
    });

    // Check for timing issues
    Object.entries(data.history.patterns).forEach(([task, patterns]) => {
      const executions = Object.values(patterns.timeOfDay);
      const stdDev = this.calculateStandardDeviation(executions);
      if (stdDev > 2) {
        risks.push({
          type: 'irregular_execution',
          severity: 'medium',
          details: `Task ${task} shows irregular execution patterns`
        });
      }
    });

    return risks;
  }

  generateRecommendations(data) {
    const recommendations = [];

    // Recommend breaking up circular dependencies
    data.circularDeps.forEach(cycle => {
      recommendations.push({
        type: 'dependency_restructure',
        priority: 'high',
        description: `Break circular dependency: ${cycle.join(' -> ')}`
      });
    });

    // Recommend optimizing low success rate tasks
    Object.entries(data.successRates).forEach(([task, rate]) => {
      if (rate.percentage < 90) {
        recommendations.push({
          type: 'reliability_improvement',
          priority: rate.percentage < 80 ? 'high' : 'medium',
          description: `Improve reliability of task ${task}`
        });
      }
    });

    // Recommend schedule optimizations
    Object.entries(data.history.patterns).forEach(([task, patterns]) => {
      const peakHour = Object.entries(patterns.timeOfDay)
        .reduce((a, b) => b[1] > a[1] ? b : a)[0];

      recommendations.push({
        type: 'schedule_optimization',
        priority: 'low',
        description: `Consider scheduling ${task} at ${peakHour}:00 UTC`
      });
    });

    return recommendations;
  }

  suggestOptimizations(data) {
    const optimizations = [];

    // Suggest parallel execution opportunities
    const parallelGroups = this.findParallelExecutionGroups(data.graph);
    if (parallelGroups.length > 0) {
      optimizations.push({
        type: 'parallel_execution',
        details: 'Tasks that can be executed in parallel',
        groups: parallelGroups
      });
    }

    // Suggest caching opportunities
    const cachingCandidates = this.findCachingCandidates(data.history);
    if (cachingCandidates.length > 0) {
      optimizations.push({
        type: 'caching',
        details: 'Tasks that could benefit from caching',
        tasks: cachingCandidates
      });
    }

    // Suggest schedule optimizations
    const scheduleOptimizations = this.findScheduleOptimizations(data.history);
    if (scheduleOptimizations.length > 0) {
      optimizations.push({
        type: 'schedule',
        details: 'Suggested schedule improvements',
        optimizations: scheduleOptimizations
      });
    }

    return optimizations;
  }

  async saveReport(report) {
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(this.graphFile), { recursive: true });

    // Save report
    await fs.promises.writeFile(
      this.graphFile,
      JSON.stringify(report, null, 2)
    );

    console.log(`Dependency analysis saved to: ${this.graphFile}`);
  }

  checkForIssues(report) {
    const issues = [];

    // Check risk factors
    report.analysis.riskFactors.forEach(risk => {
      if (risk.severity === 'high') {
        issues.push({
          type: 'risk',
          details: risk.details
        });
      }
    });

    // Check circular dependencies
    if (report.circularDependencies.length > 0) {
      issues.push({
        type: 'dependency',
        details: `Found ${report.circularDependencies.length} circular dependencies`
      });
    }

    // Check success rates
    Object.entries(report.successRates).forEach(([task, rate]) => {
      if (rate.percentage < 80) {
        issues.push({
          type: 'reliability',
          details: `Task ${task} has low success rate: ${rate.percentage.toFixed(1)}%`
        });
      }
    });

    return issues;
  }

  async notifyIssues(issues) {
    // Implementation depends on your notification system
    console.log('Found issues:', issues);
  }

  // Helper methods
  calculateStandardDeviation(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  findParallelExecutionGroups(graph) {
    // Implementation would find tasks that don't depend on each other
    return [];
  }

  findCachingCandidates(history) {
    // Implementation would find tasks with consistent outputs
    return [];
  }

  findScheduleOptimizations(history) {
    // Implementation would find better scheduling opportunities
    return [];
  }
}

// Execute if run directly
if (require.main === module) {
  const tracker = new TaskDependencyTracker();
  tracker.analyzeDependencies()
    .then(() => {
      console.log('Dependency analysis completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Dependency analysis failed:', error);
      process.exit(1);
    });
}

module.exports = TaskDependencyTracker;
