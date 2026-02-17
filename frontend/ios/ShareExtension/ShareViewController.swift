
import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    private let appGroupId = "group.com.vsseshadri.careerflow"
    private let sharedKey = "SharedJobData"
    
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
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
                            self?.saveDataAndOpenApp(url: url.absoluteString, text: nil)
                        } else {
                            self?.completeRequest()
                        }
                    }
                    return
                } else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (data, error) in
                        if let text = data as? String {
                            let url = self?.extractURL(from: text)
                            self?.saveDataAndOpenApp(url: url, text: text)
                        } else {
                            self?.completeRequest()
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
    
    private func saveDataAndOpenApp(url: String?, text: String?) {
        // Save to App Group
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
        
        // Open the main app using URL scheme
        openContainingApp()
    }
    
    private func openContainingApp() {
        guard let url = URL(string: "careerflow://share") else {
            completeRequest()
            return
        }
        
        // Use the extensionContext to open the URL (iOS 10+)
        let selectorOpenURL = sel_registerName("openURL:")
        var responder: UIResponder? = self
        
        while responder != nil {
            if responder!.responds(to: selectorOpenURL) {
                responder!.perform(selectorOpenURL, with: url)
                break
            }
            responder = responder?.next
        }
        
        // Complete the request after a short delay to allow URL to be processed
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            self?.completeRequest()
        }
    }
    
    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
