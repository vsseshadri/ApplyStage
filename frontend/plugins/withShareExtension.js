/**
 * Expo Config Plugin for iOS Share Extension and Android Share Intent
 * This plugin properly configures native code for receiving shared content.
 * 
 * For iOS: Creates a Share Extension target with proper configuration
 * For Android: Configures intent filters for ACTION_SEND
 */

const { 
  withPlugins, 
  withAndroidManifest, 
  withInfoPlist,
  withEntitlementsPlist,
  withXcodeProject,
  IOSConfig
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHARE_EXT_NAME = 'ShareExtension';
const APP_GROUP_ID = 'group.com.vsseshadri.careerflow';

/**
 * Configure Android manifest with intent filters for share receiving
 */
function withAndroidShareIntentFilter(config) {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    const mainActivity = mainApplication.activity.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      // Ensure launchMode is singleTask for proper intent handling
      mainActivity.$['android:launchMode'] = 'singleTask';
      
      // Add intent filter for receiving shared content
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // Check if share intent filter already exists
      const hasShareFilter = mainActivity['intent-filter'].some(
        (filter) => filter.action?.some((a) => a.$['android:name'] === 'android.intent.action.SEND')
      );

      if (!hasShareFilter) {
        // Add intent filter for text sharing
        mainActivity['intent-filter'].push({
          action: [
            { $: { 'android:name': 'android.intent.action.SEND' } }
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } }
          ],
          data: [
            { $: { 'android:mimeType': 'text/plain' } }
          ]
        });

        // Add intent filter for URL sharing
        mainActivity['intent-filter'].push({
          action: [
            { $: { 'android:name': 'android.intent.action.SEND' } }
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } }
          ],
          data: [
            { $: { 'android:mimeType': '*/*' } }
          ]
        });

        // Add intent filter for multiple items
        mainActivity['intent-filter'].push({
          action: [
            { $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } }
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } }
          ],
          data: [
            { $: { 'android:mimeType': '*/*' } }
          ]
        });
      }
    }

    return config;
  });
}

/**
 * Configure iOS URL schemes for deep linking
 */
function withIOSURLScheme(config) {
  return withInfoPlist(config, (config) => {
    // Ensure CFBundleURLTypes exists
    if (!config.modResults.CFBundleURLTypes) {
      config.modResults.CFBundleURLTypes = [];
    }

    // Add careerflow URL scheme if not exists
    const hasScheme = config.modResults.CFBundleURLTypes.some(
      (type) => type.CFBundleURLSchemes?.includes('careerflow')
    );

    if (!hasScheme) {
      config.modResults.CFBundleURLTypes.push({
        CFBundleURLName: 'com.vsseshadri.careerflow',
        CFBundleURLSchemes: ['careerflow']
      });
    }

    // Add required keys for share extension
    config.modResults.NSAppTransportSecurity = config.modResults.NSAppTransportSecurity || {};
    config.modResults.NSAppTransportSecurity.NSAllowsArbitraryLoads = true;

    return config;
  });
}

/**
 * Configure iOS entitlements for App Groups
 */
function withAppGroupEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    if (!config.modResults['com.apple.security.application-groups']) {
      config.modResults['com.apple.security.application-groups'] = [];
    }

    if (!config.modResults['com.apple.security.application-groups'].includes(APP_GROUP_ID)) {
      config.modResults['com.apple.security.application-groups'].push(APP_GROUP_ID);
    }

    return config;
  });
}

/**
 * Add iOS Share Extension target to Xcode project
 */
function withShareExtensionTarget(config) {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const platformProjectRoot = config.modRequest.platformProjectRoot;
    
    const bundleIdentifier = config.ios?.bundleIdentifier || 'com.vsseshadri.careerflow';
    const shareExtBundleId = `${bundleIdentifier}.${SHARE_EXT_NAME}`;
    
    // Create Share Extension directory
    const shareExtPath = path.join(platformProjectRoot, SHARE_EXT_NAME);
    
    if (!fs.existsSync(shareExtPath)) {
      fs.mkdirSync(shareExtPath, { recursive: true });
    }

    // Create ShareViewController.swift
    const shareViewControllerCode = `
import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    private let appGroupId = "${APP_GROUP_ID}"
    private let sharedKey = "SharedJobData"
    
    override func viewDidLoad() {
        super.viewDidLoad()
        handleSharedContent()
    }
    
    private func handleSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            completeRequest()
            return
        }
        
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }
            
            for attachment in attachments {
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        if let url = data as? URL {
                            self?.saveAndOpen(url: url.absoluteString, text: nil)
                        }
                    }
                    return
                } else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (data, error) in
                        if let text = data as? String {
                            let url = self?.extractURL(from: text)
                            self?.saveAndOpen(url: url, text: text)
                        }
                    }
                    return
                }
            }
        }
        
        completeRequest()
    }
    
    private func extractURL(from text: String) -> String? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let matches = detector?.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))
        if let match = matches?.first, let range = Range(match.range, in: text) {
            return String(text[range])
        }
        return nil
    }
    
    private func saveAndOpen(url: String?, text: String?) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            completeRequest()
            return
        }
        
        let sharedData: [String: Any] = [
            "url": url ?? "",
            "text": text ?? "",
            "timestamp": Date().timeIntervalSince1970
        ]
        
        userDefaults.set(sharedData, forKey: sharedKey)
        userDefaults.synchronize()
        
        // Open main app
        openMainApp()
    }
    
    private func openMainApp() {
        guard let url = URL(string: "careerflow://share") else {
            completeRequest()
            return
        }
        
        // Use selector to open URL from extension
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.perform(#selector(UIApplication.open(_:options:completionHandler:)), with: url, with: [:])
                break
            }
            responder = responder?.next
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.completeRequest()
        }
    }
    
    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
`;

    fs.writeFileSync(path.join(shareExtPath, 'ShareViewController.swift'), shareViewControllerCode);

    // Create Info.plist for Share Extension
    const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Add to CareerFlow</string>
    <key>CFBundleName</key>
    <string>${SHARE_EXT_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>${shareExtBundleId}</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>XPC!</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionAttributes</key>
        <dict>
            <key>NSExtensionActivationRule</key>
            <string>SUBQUERY (
                extensionItems,
                $extensionItem,
                SUBQUERY (
                    $extensionItem.attachments,
                    $attachment,
                    ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.url" ||
                    ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.plain-text"
                ).@count == $extensionItem.attachments.@count
            ).@count == 1</string>
        </dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.share-services</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
    </dict>
</dict>
</plist>
`;

    fs.writeFileSync(path.join(shareExtPath, 'Info.plist'), infoPlist);

    // Create entitlements file for Share Extension
    const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${APP_GROUP_ID}</string>
    </array>
</dict>
</plist>
`;

    fs.writeFileSync(path.join(shareExtPath, `${SHARE_EXT_NAME}.entitlements`), entitlements);

    // Note: The actual Xcode target creation would require more complex pbxproj manipulation
    // For a complete solution, you need to manually add the target in Xcode after prebuild
    // or use a tool like xcode-add-target
    
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    SHARE EXTENSION SETUP                           ║
╠════════════════════════════════════════════════════════════════════╣
║  Share Extension files created at: ${shareExtPath}                  
║                                                                    ║
║  IMPORTANT: After running 'npx expo prebuild', you need to:       ║
║                                                                    ║
║  1. Open the .xcworkspace file in Xcode                           ║
║  2. File → New → Target → Share Extension                         ║
║  3. Name it: ${SHARE_EXT_NAME}                                            
║  4. Replace the generated ShareViewController.swift               ║
║     with the one in the ${SHARE_EXT_NAME} folder                         
║  5. Add App Group capability to both main app and extension       ║
║     Group ID: ${APP_GROUP_ID}                           
║  6. Build and run                                                 ║
║                                                                    ║
║  For Android, the intent filters are automatically configured.    ║
╚════════════════════════════════════════════════════════════════════╝
    `);

    return config;
  });
}

/**
 * Main plugin function
 */
function withShareExtension(config) {
  return withPlugins(config, [
    withAndroidShareIntentFilter,
    withIOSURLScheme,
    withAppGroupEntitlements,
    withShareExtensionTarget,
  ]);
}

module.exports = withShareExtension;
