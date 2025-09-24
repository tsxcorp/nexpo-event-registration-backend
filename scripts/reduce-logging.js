#!/usr/bin/env node

/**
 * Script to reduce logging rate for Railway production
 * Replaces console.log with logger calls to avoid rate limits
 */

const fs = require('fs');
const path = require('path');

const logger = require('../src/utils/logger');

// Files to update (excluding already updated ones)
const filesToUpdate = [
  'src/routes/registrations.js',
  'src/routes/zohoWebhookSync.js',
  'src/routes/buffer.js',
  'src/routes/zohoCrud.js',
  'src/routes/sync.js',
  'src/routes/webhooks.js',
  'src/routes/visitors.js',
  'src/routes/events.js',
  'src/routes/groupVisitors.js',
  'src/routes/eventFiltering.js',
  'src/routes/auth.js',
  'src/routes/imports.js',
  'src/routes/zohoCreator.js',
  'src/routes/realtime.js',
  'src/routes/businessMatching.js',
  'src/utils/zohoCreatorAPI.js',
  'src/utils/zohoOAuthService.js',
  'src/utils/zohoRegistrationSubmit.js',
  'src/services/socketService.js'
];

function updateFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // Add logger import if not present
    if (!content.includes("require('../utils/logger')") && !content.includes("require('./logger')")) {
      const lines = content.split('\n');
      let insertIndex = 0;
      
      // Find where to insert logger import
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('require(') && lines[i].includes('express') || 
            lines[i].includes('require(') && lines[i].includes('redis') ||
            lines[i].includes('require(') && lines[i].includes('axios')) {
          insertIndex = i + 1;
          break;
        }
      }
      
      // Insert logger import
      const loggerImport = filePath.includes('src/routes/') ? 
        "const logger = require('../utils/logger');" :
        "const logger = require('./logger');";
      
      lines.splice(insertIndex, 0, loggerImport);
      content = lines.join('\n');
      updated = true;
    }

    // Replace console.log patterns
    const replacements = [
      // Error logs
      { from: /console\.error\(['"`](❌|🚨|⚠️|💥)\s*([^'"`]+)['"`]/g, to: 'logger.error("$2"' },
      { from: /console\.error\(['"`]([^❌🚨⚠️💥'"`][^'"`]*)['"`]/g, to: 'logger.error("$1"' },
      
      // Warning logs
      { from: /console\.warn\(['"`](⚠️|🔔|📢)\s*([^'"`]+)['"`]/g, to: 'logger.warn("$2"' },
      { from: /console\.warn\(['"`]([^⚠️🔔📢'"`][^'"`]*)['"`]/g, to: 'logger.warn("$1"' },
      
      // Info logs with emojis
      { from: /console\.log\(['"`](✅|🚀|🔄|📊|📝|📦|🔍|ℹ️|🎉|🔗|🏠|🔌|📤|📥|🛑)\s*([^'"`]+)['"`]/g, to: 'logger.info("$2"' },
      { from: /console\.log\(['"`]([^✅🚀🔄📊📝📦🔍ℹ️🎉🔗🏠🔌📤📥🛑'"`][^'"`]*)['"`]/g, to: 'logger.info("$1"' },
      
      // Generic console.log
      { from: /console\.log\(/g, to: 'logger.info(' },
    ];

    replacements.forEach(({ from, to }) => {
      if (from.test(content)) {
        content = content.replace(from, to);
        updated = true;
      }
    });

    // Remove emojis from remaining console.log calls
    content = content.replace(/console\.log\(['"`]([^'"`]*)([✅🚀🔄📊📝📦🔍ℹ️🎉🔗🏠🔌📤📥🛑❌🚨⚠️💥🔔📢])\s*([^'"`]*)['"`]/g, 'console.log("$1 $3"');

    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️ No changes needed: ${filePath}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Starting logging optimization for Railway production...');
  
  let updatedCount = 0;
  
  filesToUpdate.forEach(filePath => {
    if (updateFile(filePath)) {
      updatedCount++;
    }
  });
  
  console.log(`\n✅ Completed! Updated ${updatedCount} files.`);
  console.log('📊 Logging rate should now be reduced for Railway production.');
  
  // Update environment variables
  console.log('\n🔧 Recommended environment variables:');
  console.log('LOG_LEVEL=INFO');
  console.log('REDIS_LOG_LEVEL=WARN');
}

if (require.main === module) {
  main();
}

module.exports = { updateFile };
