# iOS Share Extension Setup Guide

## Prerequisites
- Mac with Xcode 15+ installed
- Apple Developer Account
- EAS CLI installed (`npm install -g eas-cli`)

---

## Step 1: Clone/Download Your Project

If you haven't already, download your project from Emergent or clone from your repo.

---

## Step 2: Generate Native iOS Project

Open Terminal in your `frontend` folder and run:

```bash
cd frontend
npx expo prebuild --platform ios --clean
```

This creates the `ios/` folder with native Xcode project files.

---

## Step 3: Open Project in Xcode

```bash
open ios/CareerFlow.xcworkspace
```

**Important:** Open the `.xcworkspace` file, NOT the `.xcodeproj` file.

---

## Step 4: Add Share Extension Target

1. In Xcode, go to **File → New → Target**
2. Select **iOS** tab at the top
3. Search for or scroll to **Share Extension**
4. Click **Next**
5. Configure:
   - **Product Name:** `ShareExtension`
   - **Team:** Select your Apple Developer team
   - **Language:** Swift
   - **Include UI Extension:** Uncheck this (we'll use our custom UI)
6. Click **Finish**
7. If prompted to activate the scheme, click **Cancel** (we'll handle this later)

---

## Step 5: Configure App Groups for Main App

1. In the Project Navigator (left sidebar), click on **CareerFlow** (the project, blue icon)
2. Select the **CareerFlow** target (under TARGETS)
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability** button (top left)
5. Search for and add **App Groups**
6. Click the **+** under App Groups
7. Enter: `group.com.vsseshadri.careerflow`
8. Press Enter

---

## Step 6: Configure App Groups for Share Extension

1. Select the **ShareExtension** target (under TARGETS)
2. Go to **Signing & Capabilities** tab
3. Set your **Team** (same as main app)
4. Set **Bundle Identifier** to: `com.vsseshadri.careerflow.ShareExtension`
5. Click **+ Capability** button
6. Add **App Groups**
7. Click the **+** and enter the SAME group: `group.com.vsseshadri.careerflow`

---

## Step 7: Replace ShareViewController.swift

1. In Project Navigator, expand **ShareExtension** folder
2. Click on **ShareViewController.swift**
3. **Delete ALL the existing code** and replace with:

```swift
import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    private let appGroupId = "group.com.vsseshadri.careerflow"
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
                // Handle URLs
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        DispatchQueue.main.async {
                            if let url = data as? URL {
                                self?.saveAndOpen(url: url.absoluteString, text: nil)
                            } else if let url = data as? String {
                                self?.saveAndOpen(url: url, text: nil)
                            } else {
                                self?.completeRequest()
                            }
                        }
                    }
                    return
                }
                
                // Handle plain text (might contain URL)
                if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (data, error) in
                        DispatchQueue.main.async {
                            if let text = data as? String {
                                let url = self?.extractURL(from: text)
                                self?.saveAndOpen(url: url, text: text)
                            } else {
                                self?.completeRequest()
                            }
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
        guard let url = url, !url.isEmpty else {
            completeRequest()
            return
        }
        
        // Save to App Group UserDefaults
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            completeRequest()
            return
        }
        
        let sharedData: [String: Any] = [
            "url": url,
            "text": text ?? "",
            "timestamp": Date().timeIntervalSince1970
        ]
        
        userDefaults.set(sharedData, forKey: sharedKey)
        userDefaults.synchronize()
        
        // Open main app via URL scheme
        openMainApp()
    }
    
    private func openMainApp() {
        let urlString = "careerflow://share"
        guard let url = URL(string: urlString) else {
            completeRequest()
            return
        }
        
        // Find the parent app to open URL
        let selector = NSSelectorFromString("openURL:")
        var responder: UIResponder? = self
        
        while responder != nil {
            if responder!.responds(to: selector) {
                responder!.perform(selector, with: url)
                break
            }
            responder = responder?.next
        }
        
        // Small delay to allow URL to open before dismissing
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.completeRequest()
        }
    }
    
    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
```

4. Press **Cmd + S** to save

---

## Step 8: Update Share Extension Info.plist

1. In Project Navigator, expand **ShareExtension** folder
2. Click on **Info.plist** (or Info in newer Xcode)
3. Find `NSExtension` → `NSExtensionAttributes` → `NSExtensionActivationRule`
4. Change it from a dictionary to a **String** with this value:

```
SUBQUERY (
    extensionItems,
    $extensionItem,
    SUBQUERY (
        $extensionItem.attachments,
        $attachment,
        ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.url" ||
        ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.plain-text"
    ).@count == $extensionItem.attachments.@count
).@count == 1
```

**Alternative (easier):** Right-click Info.plist → Open As → Source Code, and ensure the NSExtension section looks like:

```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionAttributes</key>
    <dict>
        <key>NSExtensionActivationRule</key>
        <string>SUBQUERY (extensionItems, $extensionItem, SUBQUERY ($extensionItem.attachments, $attachment, ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.url" || ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.plain-text").@count == $extensionItem.attachments.@count).@count == 1</string>
    </dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.share-services</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
</dict>
```

---

## Step 9: Set Deployment Target

1. Select **ShareExtension** target
2. Go to **General** tab
3. Set **Minimum Deployments** iOS version to match your main app (iOS 15.1 or your minimum)

---

## Step 10: Delete Storyboard (Use Code-Only)

1. In ShareExtension folder, find **MainInterface.storyboard**
2. Right-click → Delete → Move to Trash
3. In ShareExtension **Info.plist**, remove the `NSExtensionMainStoryboard` key if present

---

## Step 11: Build and Test Locally

1. Select a physical device or simulator
2. Select **CareerFlow** scheme (not ShareExtension)
3. Press **Cmd + R** to build and run
4. Once installed, open Safari on the device
5. Navigate to any URL (e.g., linkedin.com/jobs)
6. Tap Share button → Look for "CareerFlow" or "Add to CareerFlow"

---

## Step 12: Update .gitignore and Commit

In your project root, update `.gitignore` to NOT ignore the ios folder:

```bash
# Comment out or remove these lines if present:
# ios/
# android/
```

Then commit the native folders:

```bash
git add ios/
git add android/
git commit -m "Add native iOS Share Extension"
git push
```

---

## Step 13: Configure EAS Build for Custom Native Code

Update your `eas.json` to use the local native project:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## Step 14: Run EAS Build

```bash
eas build --platform ios --profile production
```

EAS will detect the existing `ios/` folder and use your pre-configured native project with the Share Extension.

---

## Troubleshooting

### Share Extension not appearing?
- Ensure App Groups are configured on BOTH targets
- Check Bundle ID format: main app + `.ShareExtension`
- Rebuild and reinstall the app

### App crashes when sharing?
- Check the URL scheme `careerflow://` is registered in main app's Info.plist
- Verify App Group ID matches exactly in both places

### Extension shows but nothing happens?
- Add `print()` statements in ShareViewController for debugging
- Check Xcode console for errors

---

## Need Help?

If you encounter issues, check:
1. Xcode Console for build errors
2. Device Console (Window → Devices and Simulators → View Device Logs)
3. Ensure all signing certificates and provisioning profiles are set up correctly
