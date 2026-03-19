import UIKit
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    // MARK: - Constants
    private let appGroupId = "group.com.vsseshadri.careerflow"
    private let authTokenKey = "SharedAuthToken"
    private let backendUrlKey = "SharedBackendUrl"
    
    // MARK: - UI Elements
    private let scrollView = UIScrollView()
    private let contentView = UIView()
    private let headerView = UIView()
    private let titleLabel = UILabel()
    private let cancelButton = UIButton(type: .system)
    private let saveButton = UIButton(type: .system)
    
    // Form fields
    private let companyTextField = UITextField()
    private let positionTextField = UITextField()
    private let jobTypeSegment = UISegmentedControl(items: ["Full-Time", "Part-Time", "Contract", "Internship"])
    private let workModeSegment = UISegmentedControl(items: ["Remote", "Hybrid", "On-site"])
    private let minSalaryTextField = UITextField()
    private let maxSalaryTextField = UITextField()
    private let cityTextField = UITextField()
    private let stateTextField = UITextField()
    private let jobUrlTextField = UITextField()
    private let dateAppliedTextField = UITextField()
    private let notesTextView = UITextView()
    
    private let loadingIndicator = UIActivityIndicatorView(style: .large)
    private let loadingOverlay = UIView()
    
    // Data
    private var sharedUrl: String = ""
    private var sharedText: String = ""
    
    // Keyboard handling
    private var activeTextField: UIView?
    private var scrollViewBottomConstraint: NSLayoutConstraint?
    
    // MARK: - Colors
    private let primaryBlue = UIColor(red: 0/255, green: 122/255, blue: 255/255, alpha: 1)
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupKeyboardObservers()
        extractSharedContent()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - Keyboard Handling
    private func setupKeyboardObservers() {
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillShow(_:)), name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
        
        // Add tap gesture to dismiss keyboard
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(dismissKeyboard))
        tapGesture.cancelsTouchesInView = false
        view.addGestureRecognizer(tapGesture)
    }
    
    @objc private func dismissKeyboard() {
        view.endEditing(true)
    }
    
    @objc private func keyboardWillShow(_ notification: Notification) {
        guard let keyboardFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect,
              let duration = notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double else {
            return
        }
        
        let keyboardHeight = keyboardFrame.height
        
        UIView.animate(withDuration: duration) {
            self.scrollView.contentInset.bottom = keyboardHeight + 20
            self.scrollView.verticalScrollIndicatorInsets.bottom = keyboardHeight + 20
        }
        
        // Scroll to active field if needed
        if let activeField = activeTextField {
            let fieldFrame = activeField.convert(activeField.bounds, to: scrollView)
            let visibleHeight = scrollView.frame.height - keyboardHeight
            
            if fieldFrame.maxY > visibleHeight {
                let scrollPoint = CGPoint(x: 0, y: fieldFrame.maxY - visibleHeight + 40)
                scrollView.setContentOffset(scrollPoint, animated: true)
            }
        }
    }
    
    @objc private func keyboardWillHide(_ notification: Notification) {
        guard let duration = notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double else {
            return
        }
        
        UIView.animate(withDuration: duration) {
            self.scrollView.contentInset.bottom = 0
            self.scrollView.verticalScrollIndicatorInsets.bottom = 0
        }
    }
    
    // MARK: - UI Setup
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        setupHeader()
        setupScrollView()
        setupFormFields()
        setupLoadingOverlay()
    }
    
    private func setupHeader() {
        headerView.backgroundColor = .systemBackground
        headerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerView)
        
        // Title
        titleLabel.text = "Add Job"
        titleLabel.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(titleLabel)
        
        // Cancel button
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.titleLabel?.font = UIFont.systemFont(ofSize: 17)
        cancelButton.setTitleColor(primaryBlue, for: .normal)
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(cancelButton)
        
        // Save button
        saveButton.setTitle("Save", for: .normal)
        saveButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        saveButton.setTitleColor(primaryBlue, for: .normal)
        saveButton.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(saveButton)
        
        // Separator
        let separator = UIView()
        separator.backgroundColor = .separator
        separator.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(separator)
        
        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 56),
            
            cancelButton.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            cancelButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            
            titleLabel.centerXAnchor.constraint(equalTo: headerView.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            
            saveButton.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -16),
            saveButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            
            separator.leadingAnchor.constraint(equalTo: headerView.leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: headerView.trailingAnchor),
            separator.bottomAnchor.constraint(equalTo: headerView.bottomAnchor),
            separator.heightAnchor.constraint(equalToConstant: 0.5),
        ])
    }
    
    private func setupScrollView() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.keyboardDismissMode = .interactive
        scrollView.alwaysBounceVertical = true
        view.addSubview(scrollView)
        
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)
        
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
        ])
    }
    
    private func setupFormFields() {
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = 20
        stackView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stackView)
        
        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 20),
            stackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            stackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            stackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -40),
        ])
        
        // Company Name (Required)
        stackView.addArrangedSubview(createFieldGroup(label: "Company Name *", textField: companyTextField, placeholder: "Enter company name"))
        
        // Position (Required)
        stackView.addArrangedSubview(createFieldGroup(label: "Position *", textField: positionTextField, placeholder: "Enter job title"))
        
        // Job Type
        let jobTypeGroup = createSegmentGroup(label: "Job Type", segment: jobTypeSegment)
        jobTypeSegment.selectedSegmentIndex = 0
        stackView.addArrangedSubview(jobTypeGroup)
        
        // Work Mode
        let workModeGroup = createSegmentGroup(label: "Work Mode", segment: workModeSegment)
        workModeSegment.selectedSegmentIndex = 0
        stackView.addArrangedSubview(workModeGroup)
        
        // Salary Range
        let salaryStack = UIStackView()
        salaryStack.axis = .horizontal
        salaryStack.spacing = 12
        salaryStack.distribution = .fillEqually
        
        minSalaryTextField.keyboardType = .numberPad
        maxSalaryTextField.keyboardType = .numberPad
        
        salaryStack.addArrangedSubview(createFieldGroup(label: "Min Salary", textField: minSalaryTextField, placeholder: "$0"))
        salaryStack.addArrangedSubview(createFieldGroup(label: "Max Salary", textField: maxSalaryTextField, placeholder: "$0"))
        stackView.addArrangedSubview(salaryStack)
        
        // Location - City and State
        let locationStack = UIStackView()
        locationStack.axis = .horizontal
        locationStack.spacing = 12
        locationStack.distribution = .fillEqually
        
        locationStack.addArrangedSubview(createFieldGroup(label: "City", textField: cityTextField, placeholder: "City"))
        locationStack.addArrangedSubview(createFieldGroup(label: "State", textField: stateTextField, placeholder: "State"))
        stackView.addArrangedSubview(locationStack)
        
        // Date Applied
        dateAppliedTextField.text = formatDate(Date())
        stackView.addArrangedSubview(createFieldGroup(label: "Date Applied", textField: dateAppliedTextField, placeholder: "MM/DD/YYYY"))
        
        // Job URL
        jobUrlTextField.keyboardType = .URL
        jobUrlTextField.autocapitalizationType = .none
        stackView.addArrangedSubview(createFieldGroup(label: "Job URL", textField: jobUrlTextField, placeholder: "https://..."))
        
        // Notes
        let notesGroup = UIView()
        let notesLabel = UILabel()
        notesLabel.text = "Notes"
        notesLabel.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        notesLabel.textColor = .secondaryLabel
        notesLabel.translatesAutoresizingMaskIntoConstraints = false
        notesGroup.addSubview(notesLabel)
        
        notesTextView.layer.borderColor = UIColor.separator.cgColor
        notesTextView.layer.borderWidth = 1
        notesTextView.layer.cornerRadius = 8
        notesTextView.font = UIFont.systemFont(ofSize: 16)
        notesTextView.textContainerInset = UIEdgeInsets(top: 12, left: 8, bottom: 12, right: 8)
        notesTextView.translatesAutoresizingMaskIntoConstraints = false
        notesTextView.delegate = self
        notesGroup.addSubview(notesTextView)
        
        NSLayoutConstraint.activate([
            notesLabel.topAnchor.constraint(equalTo: notesGroup.topAnchor),
            notesLabel.leadingAnchor.constraint(equalTo: notesGroup.leadingAnchor),
            
            notesTextView.topAnchor.constraint(equalTo: notesLabel.bottomAnchor, constant: 8),
            notesTextView.leadingAnchor.constraint(equalTo: notesGroup.leadingAnchor),
            notesTextView.trailingAnchor.constraint(equalTo: notesGroup.trailingAnchor),
            notesTextView.bottomAnchor.constraint(equalTo: notesGroup.bottomAnchor),
            notesTextView.heightAnchor.constraint(equalToConstant: 100),
        ])
        
        stackView.addArrangedSubview(notesGroup)
        
        // Add extra padding at bottom for keyboard
        let bottomPadding = UIView()
        bottomPadding.translatesAutoresizingMaskIntoConstraints = false
        bottomPadding.heightAnchor.constraint(equalToConstant: 50).isActive = true
        stackView.addArrangedSubview(bottomPadding)
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM/dd/yyyy"
        return formatter.string(from: date)
    }
    
    private func createFieldGroup(label: String, textField: UITextField, placeholder: String) -> UIView {
        let group = UIView()
        
        let labelView = UILabel()
        labelView.text = label
        labelView.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        labelView.textColor = .secondaryLabel
        labelView.translatesAutoresizingMaskIntoConstraints = false
        group.addSubview(labelView)
        
        textField.placeholder = placeholder
        textField.borderStyle = .roundedRect
        textField.font = UIFont.systemFont(ofSize: 16)
        textField.delegate = self
        textField.translatesAutoresizingMaskIntoConstraints = false
        group.addSubview(textField)
        
        NSLayoutConstraint.activate([
            labelView.topAnchor.constraint(equalTo: group.topAnchor),
            labelView.leadingAnchor.constraint(equalTo: group.leadingAnchor),
            
            textField.topAnchor.constraint(equalTo: labelView.bottomAnchor, constant: 8),
            textField.leadingAnchor.constraint(equalTo: group.leadingAnchor),
            textField.trailingAnchor.constraint(equalTo: group.trailingAnchor),
            textField.bottomAnchor.constraint(equalTo: group.bottomAnchor),
            textField.heightAnchor.constraint(equalToConstant: 44),
        ])
        
        return group
    }
    
    private func createSegmentGroup(label: String, segment: UISegmentedControl) -> UIView {
        let group = UIView()
        
        let labelView = UILabel()
        labelView.text = label
        labelView.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        labelView.textColor = .secondaryLabel
        labelView.translatesAutoresizingMaskIntoConstraints = false
        group.addSubview(labelView)
        
        segment.translatesAutoresizingMaskIntoConstraints = false
        group.addSubview(segment)
        
        NSLayoutConstraint.activate([
            labelView.topAnchor.constraint(equalTo: group.topAnchor),
            labelView.leadingAnchor.constraint(equalTo: group.leadingAnchor),
            
            segment.topAnchor.constraint(equalTo: labelView.bottomAnchor, constant: 8),
            segment.leadingAnchor.constraint(equalTo: group.leadingAnchor),
            segment.trailingAnchor.constraint(equalTo: group.trailingAnchor),
            segment.bottomAnchor.constraint(equalTo: group.bottomAnchor),
        ])
        
        return group
    }
    
    private func setupLoadingOverlay() {
        loadingOverlay.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        loadingOverlay.isHidden = true
        loadingOverlay.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(loadingOverlay)
        
        loadingIndicator.color = .white
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingOverlay.addSubview(loadingIndicator)
        
        NSLayoutConstraint.activate([
            loadingOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            loadingOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loadingOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            loadingIndicator.centerXAnchor.constraint(equalTo: loadingOverlay.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: loadingOverlay.centerYAnchor),
        ])
    }
    
    // MARK: - Content Extraction
    private func extractSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            return
        }
        
        var foundUrl: String?
        var foundText: String?
        
        let group = DispatchGroup()
        
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }
            
            for attachment in attachments {
                // Try to get URL
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    group.enter()
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { (data, error) in
                        if let url = data as? URL {
                            foundUrl = url.absoluteString
                        }
                        group.leave()
                    }
                }
                
                // Try to get plain text
                if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    group.enter()
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { (data, error) in
                        if let text = data as? String {
                            foundText = text
                        }
                        group.leave()
                    }
                }
            }
        }
        
        group.notify(queue: .main) { [weak self] in
            guard let self = self else { return }
            
            // Store the shared data
            if let url = foundUrl {
                self.sharedUrl = url
                self.jobUrlTextField.text = url
            }
            
            if let text = foundText {
                self.sharedText = text
                // If no URL was found directly, try to extract from text
                if foundUrl == nil, let extractedUrl = self.extractURL(from: text) {
                    self.sharedUrl = extractedUrl
                    self.jobUrlTextField.text = extractedUrl
                }
            }
            
            // Parse the shared content to populate form fields
            self.parseSharedContent()
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
    
    // MARK: - Smart Parsing
    private func parseSharedContent() {
        var jobTitle: String?
        var companyName: String?
        var city: String?
        var state: String?
        var workMode: Int = 2 // Default to On-site
        var minSalary: String?
        var maxSalary: String?
        
        let textToParse = sharedText.isEmpty ? sharedUrl : sharedText
        let cleanText = textToParse
            .replacingOccurrences(of: "Promoted", with: "")
            .replacingOccurrences(of: "People also viewed", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Check for work mode keywords
        let lowerText = cleanText.lowercased()
        if lowerText.contains("remote") {
            workMode = 0
        } else if lowerText.contains("hybrid") {
            workMode = 1
        } else if lowerText.contains("on-site") || lowerText.contains("onsite") || lowerText.contains("in-office") {
            workMode = 2
        }
        
        // Extract salary with multiple patterns
        let salaryPatterns = [
            "\\$([0-9,]+(?:\\.\\d{2})?)\\s*[kK]?\\s*[-–—to]+\\s*\\$([0-9,]+(?:\\.\\d{2})?)\\s*[kK]?",
            "\\$([0-9,]+)\\s*[-–—]\\s*\\$([0-9,]+)",
            "([0-9]+)[kK]\\s*[-–—to]+\\s*([0-9]+)[kK]",
            "USD\\s*([0-9,]+)\\s*[-–—to]+\\s*([0-9,]+)"
        ]
        
        for pattern in salaryPatterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
               let match = regex.firstMatch(in: cleanText, options: [], range: NSRange(location: 0, length: cleanText.utf16.count)) {
                if let range1 = Range(match.range(at: 1), in: cleanText),
                   let range2 = Range(match.range(at: 2), in: cleanText) {
                    var min = String(cleanText[range1]).replacingOccurrences(of: ",", with: "").replacingOccurrences(of: ".", with: "")
                    var max = String(cleanText[range2]).replacingOccurrences(of: ",", with: "").replacingOccurrences(of: ".", with: "")
                    
                    // Handle "K" suffix - if values are small, multiply by 1000
                    if let minVal = Int(min), let maxVal = Int(max) {
                        if minVal < 1000 && maxVal < 1000 {
                            min = String(minVal * 1000)
                            max = String(maxVal * 1000)
                        }
                    }
                    
                    minSalary = min
                    maxSalary = max
                    break
                }
            }
        }
        
        // Parse LinkedIn format with ":" - text after ":" is the position
        // Format: "Company Name: Job Title"
        if let colonRange = cleanText.range(of: ":") {
            let beforeColon = String(cleanText[..<colonRange.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            let afterColon = String(cleanText[colonRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Company is before ":"
            let companyPart = beforeColon.components(separatedBy: "\n").last?.trimmingCharacters(in: .whitespacesAndNewlines) ?? beforeColon
            
            // Check if company part contains "at" - if so, parse differently
            if companyPart.lowercased().contains(" at ") {
                // This might be "Check out this job at Company" format
                if let atRange = companyPart.range(of: " at ", options: .caseInsensitive) {
                    companyName = String(companyPart[atRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            } else {
                companyName = companyPart
            }
            
            // Job title is after ":", take first line and clean it
            let titlePart = afterColon.components(separatedBy: "\n").first ?? afterColon
            jobTitle = titlePart
                .replacingOccurrences(of: "·", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Try to extract location from remaining text after title
            let remainingLines = afterColon.components(separatedBy: "\n").dropFirst()
            for line in remainingLines {
                let trimmedLine = line.trimmingCharacters(in: .whitespacesAndNewlines)
                // Look for location pattern: "City, State" or just city/state names
                if trimmedLine.contains(",") && !trimmedLine.lowercased().contains("posted") && !trimmedLine.lowercased().contains("applicant") {
                    let locationParts = trimmedLine.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    if locationParts.count >= 2 {
                        city = locationParts[0]
                            .replacingOccurrences(of: "(Remote)", with: "", options: .caseInsensitive)
                            .replacingOccurrences(of: "(Hybrid)", with: "", options: .caseInsensitive)
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                        state = locationParts[1]
                            .replacingOccurrences(of: "(Remote)", with: "", options: .caseInsensitive)
                            .replacingOccurrences(of: "(Hybrid)", with: "", options: .caseInsensitive)
                            .components(separatedBy: " ").first ?? locationParts[1]
                        break
                    }
                }
            }
        }
        // Fallback: Parse "Job Title at Company · Location" format
        else if let atRange = cleanText.range(of: " at ", options: .caseInsensitive) {
            let beforeAt = String(cleanText[..<atRange.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            let afterAt = String(cleanText[atRange.upperBound...])
            
            // Job title is before "at"
            jobTitle = beforeAt.components(separatedBy: "\n").first?.trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Company and location are after "at", separated by "·"
            let parts = afterAt.components(separatedBy: "·").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            if parts.count >= 1 {
                companyName = parts[0].components(separatedBy: "\n").first?.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            if parts.count >= 2 {
                var loc = parts[1]
                    .replacingOccurrences(of: "(Remote)", with: "", options: .caseInsensitive)
                    .replacingOccurrences(of: "(Hybrid)", with: "", options: .caseInsensitive)
                    .replacingOccurrences(of: "(On-site)", with: "", options: .caseInsensitive)
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                
                loc = loc.components(separatedBy: "\n").first ?? loc
                
                if !loc.isEmpty && !loc.lowercased().contains("posted") && !loc.lowercased().contains("applicant") {
                    // Split into city and state
                    let locationParts = loc.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    if locationParts.count >= 2 {
                        city = locationParts[0]
                        state = locationParts[1].components(separatedBy: " ").first ?? locationParts[1]
                    } else if locationParts.count == 1 {
                        // Could be just a city or state
                        city = locationParts[0]
                    }
                }
            }
        }
        // Fallback: Newline-separated format
        else {
            let lines = cleanText.components(separatedBy: "\n")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            
            if lines.count >= 1 {
                let firstLine = lines[0]
                if !firstLine.contains("·") {
                    jobTitle = firstLine
                }
            }
            
            if lines.count >= 2 {
                let secondLine = lines[1]
                let parts = secondLine.components(separatedBy: "·").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                if parts.count >= 1 && companyName == nil {
                    companyName = parts[0]
                }
                if parts.count >= 2 {
                    let loc = parts[1]
                        .replacingOccurrences(of: "(Remote)", with: "", options: .caseInsensitive)
                        .replacingOccurrences(of: "(Hybrid)", with: "", options: .caseInsensitive)
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    if !loc.isEmpty && !loc.lowercased().contains("posted") {
                        let locationParts = loc.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                        if locationParts.count >= 2 {
                            city = locationParts[0]
                            state = locationParts[1].components(separatedBy: " ").first ?? locationParts[1]
                        } else {
                            city = loc
                        }
                    }
                }
            }
        }
        
        // Fallback: Try to extract company from LinkedIn URL
        if companyName == nil && sharedUrl.lowercased().contains("linkedin.com") {
            if let companyMatch = sharedUrl.range(of: "company/([^/\\?]+)", options: .regularExpression) {
                let company = String(sharedUrl[companyMatch])
                    .replacingOccurrences(of: "company/", with: "")
                    .replacingOccurrences(of: "-", with: " ")
                    .capitalized
                companyName = company
            }
        }
        
        // Clean up company name
        if var company = companyName {
            company = company
                .replacingOccurrences(of: "Reposted", with: "", options: .caseInsensitive)
                .replacingOccurrences(of: "Check out this job at", with: "", options: .caseInsensitive)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            // Remove trailing numbers
            if let range = company.range(of: "\\s*[0-9,]+$", options: .regularExpression) {
                company = String(company[..<range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            }
            companyName = company.isEmpty ? nil : company
        }
        
        // Update UI with parsed data
        if let title = jobTitle, !title.isEmpty {
            positionTextField.text = title
        }
        
        if let company = companyName, !company.isEmpty {
            companyTextField.text = company
        }
        
        if let c = city, !c.isEmpty {
            cityTextField.text = c
        }
        
        if let s = state, !s.isEmpty {
            stateTextField.text = s
        }
        
        workModeSegment.selectedSegmentIndex = workMode
        
        if let min = minSalary {
            minSalaryTextField.text = min
        }
        
        if let max = maxSalary {
            maxSalaryTextField.text = max
        }
        
        // Put original text in notes for reference
        if !sharedText.isEmpty {
            notesTextView.text = "Shared from LinkedIn:\n\(sharedText)"
        }
    }
    
    // MARK: - Actions
    @objc private func cancelTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
    
    @objc private func saveTapped() {
        // Validate required fields
        guard let company = companyTextField.text, !company.isEmpty else {
            showAlert(title: "Missing Field", message: "Please enter the company name.")
            return
        }
        
        guard let position = positionTextField.text, !position.isEmpty else {
            showAlert(title: "Missing Field", message: "Please enter the position.")
            return
        }
        
        // Get auth token and backend URL from App Group
        guard let userDefaults = UserDefaults(suiteName: appGroupId),
              let authToken = userDefaults.string(forKey: authTokenKey),
              let backendUrl = userDefaults.string(forKey: backendUrlKey) else {
            showAlert(title: "Not Logged In", message: "Please open CareerFlow and log in first, then try sharing again.")
            return
        }
        
        showLoading(true)
        
        // Prepare job data
        let jobTypes = ["full_time", "part_time", "contract", "internship"]
        let workModes = ["remote", "hybrid", "onsite"]
        
        // Build location dictionary (required by backend)
        let locationDict: [String: String] = [
            "city": cityTextField.text ?? "",
            "state": stateTextField.text ?? ""
        ]
        
        // Build salary_range dictionary (required by backend)
        let minSalaryValue = Double(minSalaryTextField.text?.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression) ?? "0") ?? 0
        let maxSalaryValue = Double(maxSalaryTextField.text?.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression) ?? "0") ?? 0
        let salaryRangeDict: [String: Double] = [
            "min": minSalaryValue,
            "max": maxSalaryValue
        ]
        
        // Parse date applied
        var dateAppliedISO = ISO8601DateFormatter().string(from: Date())
        if let dateText = dateAppliedTextField.text, !dateText.isEmpty {
            let formatter = DateFormatter()
            formatter.dateFormat = "MM/dd/yyyy"
            if let parsedDate = formatter.date(from: dateText) {
                dateAppliedISO = ISO8601DateFormatter().string(from: parsedDate)
            }
        }
        
        var jobData: [String: Any] = [
            "company_name": company,
            "position": position,
            "job_type": jobTypes[jobTypeSegment.selectedSegmentIndex],
            "work_mode": workModes[workModeSegment.selectedSegmentIndex],
            "location": locationDict,
            "salary_range": salaryRangeDict,
            "status": "applied",
            "date_applied": dateAppliedISO
        ]
        
        // Add optional fields
        if let jobUrl = jobUrlTextField.text, !jobUrl.isEmpty {
            jobData["job_url"] = jobUrl
        }
        
        if let notes = notesTextView.text, !notes.isEmpty {
            jobData["notes"] = notes
        }
        
        // Make API call
        createJob(backendUrl: backendUrl, authToken: authToken, jobData: jobData)
    }
    
    private func createJob(backendUrl: String, authToken: String, jobData: [String: Any]) {
        guard let url = URL(string: "\(backendUrl)/api/jobs") else {
            showLoading(false)
            showAlert(title: "Error", message: "Invalid backend URL.")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 30
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: jobData)
        } catch {
            showLoading(false)
            showAlert(title: "Error", message: "Failed to prepare job data.")
            return
        }
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.showLoading(false)
                
                if let error = error {
                    self?.showAlert(title: "Network Error", message: "Failed to save job: \(error.localizedDescription)")
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    self?.showAlert(title: "Error", message: "Invalid response from server.")
                    return
                }
                
                if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                    // Success - show brief confirmation then close
                    let successAlert = UIAlertController(title: "✓ Saved", message: "Job added to CareerFlow", preferredStyle: .alert)
                    self?.present(successAlert, animated: true) {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                            self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
                        }
                    }
                } else if httpResponse.statusCode == 401 {
                    self?.showAlert(title: "Session Expired", message: "Please open CareerFlow and log in again.")
                } else if httpResponse.statusCode == 422 {
                    var message = "Please check your input and try again."
                    if let data = data,
                       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let detail = json["detail"] {
                        message = "\(detail)"
                    }
                    self?.showAlert(title: "Validation Error", message: message)
                } else {
                    let message = "Failed to save job (Error \(httpResponse.statusCode))."
                    if let data = data, let responseStr = String(data: data, encoding: .utf8) {
                        print("Server response: \(responseStr)")
                    }
                    self?.showAlert(title: "Error", message: message)
                }
            }
        }.resume()
    }
    
    // MARK: - Helpers
    private func showLoading(_ show: Bool) {
        loadingOverlay.isHidden = !show
        if show {
            loadingIndicator.startAnimating()
        } else {
            loadingIndicator.stopAnimating()
        }
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - UITextFieldDelegate
extension ShareViewController: UITextFieldDelegate {
    func textFieldDidBeginEditing(_ textField: UITextField) {
        activeTextField = textField
    }
    
    func textFieldDidEndEditing(_ textField: UITextField) {
        activeTextField = nil
    }
    
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
}

// MARK: - UITextViewDelegate
extension ShareViewController: UITextViewDelegate {
    func textViewDidBeginEditing(_ textView: UITextView) {
        activeTextField = textView
    }
    
    func textViewDidEndEditing(_ textView: UITextView) {
        activeTextField = nil
    }
}
