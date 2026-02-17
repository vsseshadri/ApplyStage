
import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    private let appGroupId = "group.com.vsseshadri.careerflow"
    private let sharedKey = "SharedJobData"
    
    // UI Elements
    private let containerView = UIView()
    private let iconLabel = UILabel()
    private let titleLabel = UILabel()
    private let messageLabel = UILabel()
    private let doneButton = UIButton(type: .system)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        handleSharedContent()
    }
    
    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        
        // Container
        containerView.backgroundColor = .systemBackground
        containerView.layer.cornerRadius = 20
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)
        
        // Icon
        iconLabel.text = "✓"
        iconLabel.font = UIFont.systemFont(ofSize: 48, weight: .bold)
        iconLabel.textColor = .systemGreen
        iconLabel.textAlignment = .center
        iconLabel.translatesAutoresizingMaskIntoConstraints = false
        iconLabel.alpha = 0
        containerView.addSubview(iconLabel)
        
        // Title
        titleLabel.text = "Saving..."
        titleLabel.font = UIFont.systemFont(ofSize: 20, weight: .bold)
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(titleLabel)
        
        // Message
        messageLabel.text = "Please wait..."
        messageLabel.font = UIFont.systemFont(ofSize: 14)
        messageLabel.textColor = .secondaryLabel
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0
        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(messageLabel)
        
        // Done Button (hidden initially)
        doneButton.setTitle("Open CareerFlow", for: .normal)
        doneButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        doneButton.backgroundColor = UIColor(red: 0, green: 122/255, blue: 1, alpha: 1)
        doneButton.setTitleColor(.white, for: .normal)
        doneButton.layer.cornerRadius = 12
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        doneButton.alpha = 0
        doneButton.addTarget(self, action: #selector(doneButtonTapped), for: .touchUpInside)
        containerView.addSubview(doneButton)
        
        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 300),
            containerView.heightAnchor.constraint(equalToConstant: 260),
            
            iconLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 30),
            iconLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            
            titleLabel.topAnchor.constraint(equalTo: iconLabel.bottomAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            titleLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            
            messageLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            messageLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            messageLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            
            doneButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -20),
            doneButton.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            doneButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            doneButton.heightAnchor.constraint(equalToConstant: 50),
        ])
    }
    
    private func showSuccess() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.titleLabel.text = "Job Saved!"
            self.messageLabel.text = "Open CareerFlow to review and add this job to your tracker."
            
            UIView.animate(withDuration: 0.3) {
                self.iconLabel.alpha = 1
                self.doneButton.alpha = 1
            }
        }
    }
    
    private func showError() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.iconLabel.text = "✗"
            self.iconLabel.textColor = .systemRed
            self.titleLabel.text = "Error"
            self.messageLabel.text = "Could not save the job. Please try again."
            self.doneButton.setTitle("Close", for: .normal)
            
            UIView.animate(withDuration: 0.3) {
                self.iconLabel.alpha = 1
                self.doneButton.alpha = 1
            }
        }
    }
    
    @objc private func doneButtonTapped() {
        completeRequest()
    }
    
    private func handleSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showError()
            return
        }
        
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }
            
            for attachment in attachments {
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        if let url = data as? URL {
                            self?.saveData(url: url.absoluteString, text: nil)
                        } else {
                            self?.showError()
                        }
                    }
                    return
                } else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (data, error) in
                        if let text = data as? String {
                            let url = self?.extractURL(from: text)
                            self?.saveData(url: url, text: text)
                        } else {
                            self?.showError()
                        }
                    }
                    return
                }
            }
        }
        
        showError()
    }
    
    private func extractURL(from text: String) -> String? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let matches = detector?.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))
        if let match = matches?.first, let range = Range(match.range, in: text) {
            return String(text[range])
        }
        return nil
    }
    
    private func saveData(url: String?, text: String?) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            showError()
            return
        }
        
        let sharedData: [String: Any] = [
            "url": url ?? "",
            "text": text ?? "",
            "timestamp": Date().timeIntervalSince1970
        ]
        
        userDefaults.set(sharedData, forKey: sharedKey)
        userDefaults.synchronize()
        
        // Show success UI
        showSuccess()
    }
    
    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
