
import UIKit
import Social
import MobileCoreServices
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
