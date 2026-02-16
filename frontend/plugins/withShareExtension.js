/**
 * Expo Config Plugin for Share Extension (iOS) and Intent Filters (Android)
 * This plugin configures the native code needed for receiving shared content from other apps.
 */

const { withPlugins, withAndroidManifest, withInfoPlist, withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// iOS Share Extension Swift Code
const SHARE_EXTENSION_SWIFT = `
import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: SLComposeServiceViewController {
    
    private var sharedURL: String?
    private var sharedText: String?
    
    override func isContentValid() -> Bool {
        return true
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Extract shared content
        extractSharedContent()
    }
    
    private func extractSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            return
        }
        
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }
            
            for attachment in attachments {
                // Handle URLs
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        if let url = data as? URL {
                            self?.sharedURL = url.absoluteString
                        } else if let urlData = data as? Data, let urlString = String(data: urlData, encoding: .utf8) {
                            self?.sharedURL = urlString
                        }
                    }
                }
                
                // Handle plain text
                if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (data, error) in
                        if let text = data as? String {
                            // Check if text contains a URL
                            if let url = self?.extractURL(from: text) {
                                self?.sharedURL = url
                            }
                            self?.sharedText = text
                        }
                    }
                }
            }
        }
    }
    
    private func extractURL(from text: String) -> String? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let matches = detector?.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))
        
        if let match = matches?.first, let range = Range(match.range, in: text) {
            return String(text[range])
        }
        return nil
    }
    
    override func didSelectPost() {
        // Save to App Group
        saveToAppGroup()
        
        // Open main app via deep link
        openMainApp()
        
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
    
    private func saveToAppGroup() {
        guard let userDefaults = UserDefaults(suiteName: "group.com.vsseshadri.careerflow") else {
            return
        }
        
        let sharedData: [String: Any] = [
            "url": sharedURL ?? "",
            "text": sharedText ?? "",
            "timestamp": Date().timeIntervalSince1970
        ]
        
        userDefaults.set(sharedData, forKey: "SharedJobData")
        userDefaults.synchronize()
    }
    
    private func openMainApp() {
        let urlString = "careerflow://share"
        guard let url = URL(string: urlString) else { return }
        
        // Use responder chain to open URL
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = responder?.next
        }
        
        // Fallback: Use selector
        let selector = sel_registerName("openURL:")
        var currentResponder: UIResponder? = self
        while currentResponder != nil {
            if currentResponder!.responds(to: selector) {
                currentResponder!.perform(selector, with: url)
                return
            }
            currentResponder = currentResponder?.next
        }
    }
    
    override func configurationItems() -> [Any]! {
        return []
    }
}
`;

// iOS Share Extension Info.plist content
const SHARE_EXTENSION_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Add to CareerFlow</string>
    <key>CFBundleName</key>
    <string>ShareExtension</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
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
            <dict>
                <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
                <integer>1</integer>
                <key>NSExtensionActivationSupportsText</key>
                <true/>
            </dict>
        </dict>
        <key>NSExtensionMainStoryboard</key>
        <string>MainInterface</string>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.share-services</string>
    </dict>
</dict>
</plist>
`;

// iOS Share Extension Entitlements
const SHARE_EXTENSION_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.vsseshadri.careerflow</string>
    </array>
</dict>
</plist>
`;

// iOS MainInterface.storyboard for Share Extension
const MAIN_INTERFACE_STORYBOARD = `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="21701" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="BYZ-38-t0r">
    <device id="retina6_1" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="21679"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="tne-QT-ifu">
            <objects>
                <viewController id="BYZ-38-t0r" customClass="ShareViewController" customModule="ShareExtension" customModuleProvider="target" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="8bC-Xf-vdC">
                        <rect key="frame" x="0.0" y="0.0" width="414" height="896"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <viewLayoutGuide key="safeArea" id="6Tk-OE-BBY"/>
                        <color key="backgroundColor" systemColor="systemBackgroundColor"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="dkx-z0-nzr" sceneMemberID="firstResponder"/>
            </objects>
        </scene>
    </scenes>
</document>
`;

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
            // Add intent filter for receiving shared content
            if (!mainActivity['intent-filter']) {
                mainActivity['intent-filter'] = [];
            }

            // Check if share intent filter already exists
            const hasShareFilter = mainActivity['intent-filter'].some(
                (filter) => filter.action?.some((a) => a.$['android:name'] === 'android.intent.action.SEND')
            );

            if (!hasShareFilter) {
                mainActivity['intent-filter'].push({
                    action: [
                        { $: { 'android:name': 'android.intent.action.SEND' } },
                        { $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } }
                    ],
                    category: [
                        { $: { 'android:name': 'android.intent.category.DEFAULT' } }
                    ],
                    data: [
                        { $: { 'android:mimeType': 'text/plain' } },
                        { $: { 'android:mimeType': 'text/*' } }
                    ]
                });
            }
        }

        return config;
    });
}

/**
 * Configure iOS Info.plist for URL scheme handling
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

        if (!config.modResults['com.apple.security.application-groups'].includes('group.com.vsseshadri.careerflow')) {
            config.modResults['com.apple.security.application-groups'].push('group.com.vsseshadri.careerflow');
        }

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
    ]);
}

module.exports = withShareExtension;
