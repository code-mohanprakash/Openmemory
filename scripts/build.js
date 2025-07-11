#!/usr/bin/env node

/**
 * Production Build Script for OpenMemory Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ExtensionBuilder {
  constructor() {
    this.buildDir = path.join(__dirname, '..', 'dist');
    this.sourceDir = path.join(__dirname, '..');
    this.version = this.getVersion();
  }

  async build() {
    console.log('🚀 Building OpenMemory Extension...\n');

    try {
      // Step 1: Clean previous build
      await this.clean();

      // Step 2: Run linting
      await this.lint();

      // Step 3: Run tests
      await this.test();

      // Step 4: Create build directory
      await this.createBuildDir();

      // Step 5: Copy source files
      await this.copySourceFiles();

      // Step 6: Update manifest for production
      await this.updateManifest();

      // Step 7: Optimize files
      await this.optimizeFiles();

      // Step 8: Generate build info
      await this.generateBuildInfo();

      // Step 9: Create ZIP package
      await this.createPackage();

      console.log('✅ Build completed successfully!');
      console.log(`📦 Extension package: dist/openmemory-extension-v${this.version}.zip`);

    } catch (error) {
      console.error('❌ Build failed:', error.message);
      process.exit(1);
    }
  }

  async clean() {
    console.log('🧹 Cleaning previous build...');
    
    if (fs.existsSync(this.buildDir)) {
      fs.rmSync(this.buildDir, { recursive: true, force: true });
    }
  }

  async lint() {
    console.log('🔍 Running ESLint...');
    
    try {
      execSync('npm run lint', { 
        stdio: 'inherit',
        cwd: this.sourceDir 
      });
      console.log('✅ Linting passed\n');
    } catch (error) {
      throw new Error('Linting failed. Please fix the issues and try again.');
    }
  }

  async test() {
    console.log('🧪 Running tests...');
    
    try {
      execSync('npm test', { 
        stdio: 'inherit',
        cwd: this.sourceDir 
      });
      console.log('✅ All tests passed\n');
    } catch (error) {
      throw new Error('Tests failed. Please fix the issues and try again.');
    }
  }

  async createBuildDir() {
    console.log('📁 Creating build directory...');
    fs.mkdirSync(this.buildDir, { recursive: true });
  }

  async copySourceFiles() {
    console.log('📋 Copying source files...');

    const filesToCopy = [
      'manifest.json',
      'popup/popup.html',
      'popup/popup.js',
      'src/content-script.js',
      'src/memory-engine.js',
      'src/background.js',
      'src/styles.css',
      'src/error-handler.js',
      'src/config.js',
      'icons/'
    ];

    for (const file of filesToCopy) {
      const sourcePath = path.join(this.sourceDir, file);
      const destPath = path.join(this.buildDir, file);

      if (fs.existsSync(sourcePath)) {
        const stat = fs.statSync(sourcePath);
        
        if (stat.isDirectory()) {
          this.copyDirectory(sourcePath, destPath);
        } else {
          // Ensure directory exists
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(sourcePath, destPath);
        }
      }
    }
  }

  copyDirectory(source, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const items = fs.readdirSync(source);
    
    for (const item of items) {
      const sourcePath = path.join(source, item);
      const destPath = path.join(dest, item);
      const stat = fs.statSync(sourcePath);

      if (stat.isDirectory()) {
        this.copyDirectory(sourcePath, destPath);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  }

  async updateManifest() {
    console.log('📝 Updating manifest for production...');

    const manifestPath = path.join(this.buildDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Update for production
    manifest.version = this.version;
    
    // Remove development-only permissions if any
    if (manifest.permissions) {
      manifest.permissions = manifest.permissions.filter(permission => 
        !permission.includes('localhost') && !permission.includes('127.0.0.1')
      );
    }

    // Add production CSP if not present
    if (!manifest.content_security_policy) {
      manifest.content_security_policy = {
        extension_pages: "script-src 'self'; object-src 'self'"
      };
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  async optimizeFiles() {
    console.log('⚡ Optimizing files...');

    // Remove debug code from production files
    const jsFiles = [
      path.join(this.buildDir, 'src/content-script.js'),
      path.join(this.buildDir, 'src/memory-engine.js'),
      path.join(this.buildDir, 'popup/popup.js')
    ];

    for (const file of jsFiles) {
      if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        
        // Remove debug statements
        content = content.replace(/console\.debug\(.*?\);?\n/g, '');
        content = content.replace(/console\.log\('.*?DEBUG.*?'\);?\n/g, '');
        
        // Update config for production
        content = content.replace(
          /ENVIRONMENT:\s*'development'/g, 
          "ENVIRONMENT: 'production'"
        );
        content = content.replace(
          /DEBUG:\s*true/g, 
          'DEBUG: false'
        );
        
        fs.writeFileSync(file, content);
      }
    }

    // Minify CSS
    const cssFile = path.join(this.buildDir, 'src/styles.css');
    if (fs.existsSync(cssFile)) {
      let css = fs.readFileSync(cssFile, 'utf8');
      
      // Basic CSS minification
      css = css.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove comments
      css = css.replace(/\s+/g, ' '); // Collapse whitespace
      css = css.replace(/;\s*}/g, '}'); // Remove unnecessary semicolons
      css = css.trim();
      
      fs.writeFileSync(cssFile, css);
    }
  }

  async generateBuildInfo() {
    console.log('📊 Generating build info...');

    const buildInfo = {
      version: this.version,
      buildTime: new Date().toISOString(),
      buildNumber: process.env.BUILD_NUMBER || Date.now(),
      gitCommit: this.getGitCommit(),
      nodeVersion: process.version,
      environment: 'production'
    };

    fs.writeFileSync(
      path.join(this.buildDir, 'build-info.json'),
      JSON.stringify(buildInfo, null, 2)
    );
  }

  async createPackage() {
    console.log('📦 Creating extension package...');

    const zipName = `openmemory-extension-v${this.version}.zip`;
    const zipPath = path.join(this.buildDir, zipName);

    try {
      // Create zip using node's built-in zip functionality or system zip
      execSync(`cd "${this.buildDir}" && zip -r "${zipName}" . -x "*.zip"`, {
        stdio: 'pipe'
      });
      
      console.log(`✅ Package created: ${zipName}`);
      
      // Calculate file size
      const stats = fs.statSync(zipPath);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`📏 Package size: ${fileSizeInMB} MB`);
      
    } catch (error) {
      console.warn('⚠️  Could not create zip package. Files are available in dist/ directory.');
    }
  }

  getVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(
        path.join(this.sourceDir, 'package.json'), 
        'utf8'
      ));
      return packageJson.version || '1.0.0';
    } catch (error) {
      return '1.0.0';
    }
  }

  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { 
        encoding: 'utf8',
        cwd: this.sourceDir 
      }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  // Validation methods
  async validateBuild() {
    console.log('🔍 Validating build...');

    const requiredFiles = [
      'manifest.json',
      'popup/popup.html',
      'src/content-script.js',
      'src/memory-engine.js'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.buildDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Validate manifest
    const manifest = JSON.parse(fs.readFileSync(
      path.join(this.buildDir, 'manifest.json'),
      'utf8'
    ));

    if (!manifest.version || !manifest.name) {
      throw new Error('Invalid manifest.json');
    }

    console.log('✅ Build validation passed');
  }
}

// Run build if this script is executed directly
if (require.main === module) {
  const builder = new ExtensionBuilder();
  builder.build().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

module.exports = ExtensionBuilder;