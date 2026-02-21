import UIKit
import MobileCoreServices
import UniformTypeIdentifiers
import Vision

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
    private let locationTextField = UITextField()
    private let jobUrlTextField = UITextField()
    private let notesTextView = UITextView()
    
    private let loadingIndicator = UIActivityIndicatorView(style: .large)
    private let loadingOverlay = UIView()
    
    // Data
    private var sharedUrl: String = ""
    private var sharedText: String = ""
    
    // MARK: - Colors
    private let primaryBlue = UIColor(red: 0/255, green: 122/255, blue: 255/255, alpha: 1)
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        extractSharedContent()
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
            stackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -20),
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
        
        // Location
        stackView.addArrangedSubview(createFieldGroup(label: "Location", textField: locationTextField, placeholder: "City, State"))
        
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
        
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }
            
            for attachment in attachments {
                // Handle Image sharing (for OCR)
                if attachment.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] (data, error) in
                        DispatchQueue.main.async {
                            self?.showLoading(true)
                        }
                        
                        var imageToProcess: UIImage?
                        
                        if let image = data as? UIImage {
                            imageToProcess = image
                        } else if let imageData = data as? Data, let image = UIImage(data: imageData) {
                            imageToProcess = image
                        } else if let imageUrl = data as? URL, let imageData = try? Data(contentsOf: imageUrl), let image = UIImage(data: imageData) {
                            imageToProcess = image
                        }
                        
                        if let image = imageToProcess {
                            self?.performOCR(on: image)
                        } else {
                            DispatchQueue.main.async {
                                self?.showLoading(false)
                            }
                        }
                    }
                    return
                }
                // Handle URL sharing
                else if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        if let url = data as? URL {
                            DispatchQueue.main.async {
                                self?.sharedUrl = url.absoluteString
                                self?.jobUrlTextField.text = url.absoluteString
                                self?.showLoading(true)
                            }
                            self?.fetchLinkedInJobData(from: url.absoluteString)
                        }
                    }
                    return
                }
                // Handle plain text sharing
                else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (data, error) in
                        if let text = data as? String {
                            DispatchQueue.main.async {
                                self?.sharedText = text
                                if let url = self?.extractURL(from: text) {
                                    self?.sharedUrl = url
                                    self?.jobUrlTextField.text = url
                                    self?.showLoading(true)
                                    self?.fetchLinkedInJobData(from: url)
                                } else {
                                    self?.notesTextView.text = text
                                }
                            }
                        }
                    }
                    return
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
    
    // MARK: - OCR Processing
    private func performOCR(on image: UIImage) {
        guard let cgImage = image.cgImage else {
            DispatchQueue.main.async {
                self.showLoading(false)
            }
            return
        }
        
        let request = VNRecognizeTextRequest { [weak self] request, error in
            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                DispatchQueue.main.async {
                    self?.showLoading(false)
                }
                return
            }
            
            // Extract all recognized text lines
            var allLines: [String] = []
            for observation in observations {
                if let topCandidate = observation.topCandidates(1).first {
                    let text = topCandidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !text.isEmpty {
                        allLines.append(text)
                    }
                }
            }
            
            DispatchQueue.main.async {
                self?.parseLinkedInScreenshot(lines: allLines)
                self?.showLoading(false)
            }
        }
        
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                DispatchQueue.main.async {
                    self.showLoading(false)
                }
            }
        }
    }
    
    // MARK: - LinkedIn Screenshot Parsing (OCR)
    private func parseLinkedInScreenshot(lines: [String]) {
        // LinkedIn UI junk text to filter out
        let junkPatterns: Set<String> = [
            "jobs", "home", "my network", "post", "notifications", "linkedin",
            "search", "messaging", "me", "work", "describe the job you want",
            "sign in", "join now", "apply", "save", "easy apply", "premium",
            "show more", "show less", "people you can reach out to", "about the job",
            "see who", "continue with google", "sign in with email", "company alumni",
            "people also viewed", "am i a good fit for this job", "use ai to assess",
            "show match details", "create cover letter"
        ]
        
        // Filter out junk lines
        var meaningfulLines: [String] = []
        for line in lines {
            let lowercaseLine = line.lowercased()
            
            // Skip timestamp patterns like "5:14"
            if line.range(of: "^\\d{1,2}:\\d{2}$", options: .regularExpression) != nil {
                continue
            }
            
            // Skip purely numeric lines
            if line.range(of: "^[\\d\\s]+$", options: .regularExpression) != nil {
                continue
            }
            
            // Skip junk patterns
            var isJunk = false
            for junk in junkPatterns {
                if lowercaseLine == junk || lowercaseLine.hasPrefix(junk + " ") {
                    isJunk = true
                    break
                }
            }
            if isJunk { continue }
            
            // Skip very short lines (likely UI elements)
            if line.count < 3 { continue }
            
            // Skip lines that look like button labels or icons
            if line == "..." || line == "CA" || line == "CIB" { continue }
            
            meaningfulLines.append(line)
        }
        
        // Parse the meaningful lines
        var companyName: String?
        var position: String?
        var location: String?
        var salary: String?
        var jobType: String?
        var workMode: String?
        
        for (index, line) in meaningfulLines.enumerated() {
            let lowercaseLine = line.lowercased()
            
            // Check for salary pattern (highest priority - unique identifier)
            if line.contains("$") && salary == nil {
                // Extract salary range
                if let salaryMatch = line.range(of: "\\$[\\d,]+(?:\\.\\d+)?(?:K)?(?:/yr)?(?:\\s*-\\s*\\$[\\d,]+(?:\\.\\d+)?(?:K)?(?:/yr)?)?", options: .regularExpression) {
                    salary = String(line[salaryMatch])
                }
                continue
            }
            
            // Check for job type
            if jobType == nil {
                if lowercaseLine.contains("full-time") || lowercaseLine.contains("full time") {
                    jobType = "Full-Time"
                } else if lowercaseLine.contains("part-time") || lowercaseLine.contains("part time") {
                    jobType = "Part-Time"
                } else if lowercaseLine.contains("contract") {
                    jobType = "Contract"
                } else if lowercaseLine.contains("internship") {
                    jobType = "Internship"
                }
            }
            
            // Check for work mode
            if workMode == nil {
                if lowercaseLine.contains("hybrid") {
                    workMode = "Hybrid"
                } else if lowercaseLine.contains("remote") {
                    workMode = "Remote"
                } else if lowercaseLine.contains("on-site") || lowercaseLine.contains("onsite") {
                    workMode = "On-site"
                }
            }
            
            // Check for location pattern (City, ST)
            if location == nil {
                if let locationMatch = line.range(of: "[A-Z][a-zA-Z\\s]+,\\s*[A-Z]{2}\\b", options: .regularExpression) {
                    let potentialLocation = String(line[locationMatch])
                    // Verify it's not the company name we already found
                    if companyName == nil || !potentialLocation.lowercased().contains(companyName!.lowercased()) {
                        location = potentialLocation
                    }
                }
            }
        }
        
        // For Company and Position: Use the first two meaningful non-special lines
        // (after filtering out salary, location, job type, work mode lines)
        var candidateLines: [String] = []
        for line in meaningfulLines {
            let lowercaseLine = line.lowercased()
            
            // Skip lines we've already identified
            if line.contains("$") { continue }
            if lowercaseLine.contains("full-time") || lowercaseLine.contains("part-time") ||
               lowercaseLine.contains("contract") || lowercaseLine.contains("internship") { continue }
            if lowercaseLine.contains("hybrid") || lowercaseLine.contains("remote") ||
               lowercaseLine.contains("on-site") || lowercaseLine.contains("onsite") { continue }
            if line.range(of: "[A-Z][a-zA-Z\\s]+,\\s*[A-Z]{2}\\b", options: .regularExpression) != nil { continue }
            
            // Skip lines with "applicants", "ago", "day", "week"
            if lowercaseLine.contains("applicant") || lowercaseLine.contains(" ago") ||
               lowercaseLine.contains("day") || lowercaseLine.contains("week") { continue }
            
            candidateLines.append(line)
        }
        
        // Line 1 = Company Name, Line 2 = Position (as per user's instruction)
        if candidateLines.count >= 1 {
            companyName = candidateLines[0]
        }
        if candidateLines.count >= 2 {
            position = candidateLines[1]
        }
        
        // Update the form with extracted values
        updateFormFields(
            companyName: companyName,
            position: position,
            location: location,
            salary: salary,
            jobType: jobType,
            workMode: workMode
        )
    }
    
    // MARK: - LinkedIn URL Parsing
    private func fetchLinkedInJobData(from urlString: String) {
        // Extract job ID from LinkedIn URL
        guard let jobId = extractLinkedInJobId(from: urlString) else {
            DispatchQueue.main.async {
                self.showLoading(false)
            }
            return
        }
        
        // Try LinkedIn guest API first
        let guestApiUrl = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/\(jobId)"
        
        guard let url = URL(string: guestApiUrl) else {
            DispatchQueue.main.async {
                self.showLoading(false)
            }
            return
        }
        
        var request = URLRequest(url: url)
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", forHTTPHeaderField: "User-Agent")
        request.setValue("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 10
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let data = data, let html = String(data: data, encoding: .utf8) else {
                // Fallback to regular page fetch
                self?.fetchLinkedInPageHTML(from: urlString)
                return
            }
            
            // Parse the HTML response
            let parsedData = self?.parseLinkedInHTML(html)
            
            DispatchQueue.main.async {
                if let parsed = parsedData, parsed.hasData {
                    self?.updateFormFields(
                        companyName: parsed.company,
                        position: parsed.position,
                        location: parsed.location,
                        salary: parsed.salary,
                        jobType: parsed.jobType,
                        workMode: parsed.workMode
                    )
                    self?.showLoading(false)
                } else {
                    // Fallback to regular page fetch
                    self?.fetchLinkedInPageHTML(from: urlString)
                }
            }
        }.resume()
    }
    
    private func fetchLinkedInPageHTML(from urlString: String) {
        guard let url = URL(string: urlString) else {
            DispatchQueue.main.async {
                self.showLoading(false)
            }
            return
        }
        
        var request = URLRequest(url: url)
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 10
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.showLoading(false)
            }
            
            guard let data = data, let html = String(data: data, encoding: .utf8) else {
                return
            }
            
            let parsedData = self?.parseLinkedInHTML(html)
            
            DispatchQueue.main.async {
                if let parsed = parsedData {
                    self?.updateFormFields(
                        companyName: parsed.company,
                        position: parsed.position,
                        location: parsed.location,
                        salary: parsed.salary,
                        jobType: parsed.jobType,
                        workMode: parsed.workMode
                    )
                }
            }
        }.resume()
    }
    
    private func extractLinkedInJobId(from urlString: String) -> String? {
        // Match patterns like /jobs/view/4374078676/ or /jobs/view/4374078676
        if let range = urlString.range(of: "/jobs/view/(\\d+)", options: .regularExpression) {
            let match = String(urlString[range])
            return match.replacingOccurrences(of: "/jobs/view/", with: "")
        }
        
        // Match pattern like jobId=4374078676
        if let range = urlString.range(of: "jobId=(\\d+)", options: .regularExpression) {
            let match = String(urlString[range])
            return match.replacingOccurrences(of: "jobId=", with: "")
        }
        
        return nil
    }
    
    private struct ParsedJobData {
        var company: String?
        var position: String?
        var location: String?
        var salary: String?
        var jobType: String?
        var workMode: String?
        
        var hasData: Bool {
            return company != nil || position != nil
        }
    }
    
    private func parseLinkedInHTML(_ html: String) -> ParsedJobData {
        var result = ParsedJobData()
        
        // Extract position from title tag or h1
        // Pattern: <title>VP, Strategy &amp; Delivery Excellence | Travelers | LinkedIn</title>
        if let titleRange = html.range(of: "<title>([^<]+)</title>", options: .regularExpression) {
            var title = String(html[titleRange])
            title = title.replacingOccurrences(of: "<title>", with: "")
            title = title.replacingOccurrences(of: "</title>", with: "")
            title = decodeHTMLEntities(title)
            
            // Parse: "Position | Company | LinkedIn" or "Position - Company | LinkedIn"
            let parts = title.components(separatedBy: " | ")
            if parts.count >= 2 {
                result.position = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
                let companyPart = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
                if companyPart.lowercased() != "linkedin" {
                    result.company = companyPart
                }
            } else {
                // Try dash separator
                let dashParts = title.components(separatedBy: " - ")
                if dashParts.count >= 2 {
                    result.position = dashParts[0].trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
        }
        
        // Try to extract company from og:title meta tag
        if result.company == nil {
            if let ogTitleRange = html.range(of: "property=\"og:title\"\\s+content=\"([^\"]+)\"", options: .regularExpression) {
                var ogTitle = String(html[ogTitleRange])
                if let contentRange = ogTitle.range(of: "content=\"([^\"]+)\"", options: .regularExpression) {
                    var content = String(ogTitle[contentRange])
                    content = content.replacingOccurrences(of: "content=\"", with: "")
                    content = content.replacingOccurrences(of: "\"", with: "")
                    content = decodeHTMLEntities(content)
                    
                    let parts = content.components(separatedBy: " | ")
                    if parts.count >= 2 && result.company == nil {
                        let companyPart = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
                        if companyPart.lowercased() != "linkedin" {
                            result.company = companyPart
                        }
                    }
                }
            }
        }
        
        // Extract location - look for City, ST pattern
        if let locationRange = html.range(of: "([A-Z][a-zA-Z\\s]+,\\s*[A-Z]{2})", options: .regularExpression) {
            result.location = String(html[locationRange])
        }
        
        // Extract salary
        if let salaryRange = html.range(of: "\\$[\\d,]+(?:\\.\\d+)?(?:/yr)?(?:\\s*-\\s*\\$[\\d,]+(?:\\.\\d+)?(?:/yr)?)?", options: .regularExpression) {
            result.salary = String(html[salaryRange])
        }
        
        // Extract job type
        let htmlLower = html.lowercased()
        if htmlLower.contains("full-time") || htmlLower.contains("full time") {
            result.jobType = "Full-Time"
        } else if htmlLower.contains("part-time") || htmlLower.contains("part time") {
            result.jobType = "Part-Time"
        } else if htmlLower.contains("\"contract\"") {
            result.jobType = "Contract"
        } else if htmlLower.contains("internship") {
            result.jobType = "Internship"
        }
        
        // Extract work mode
        if htmlLower.contains("\"hybrid\"") || htmlLower.contains(">hybrid<") {
            result.workMode = "Hybrid"
        } else if htmlLower.contains("\"remote\"") || htmlLower.contains(">remote<") {
            result.workMode = "Remote"
        } else if htmlLower.contains("on-site") || htmlLower.contains("onsite") {
            result.workMode = "On-site"
        }
        
        return result
    }
    
    private func decodeHTMLEntities(_ string: String) -> String {
        var result = string
        let entities: [String: String] = [
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": "\"",
            "&#39;": "'",
            "&apos;": "'",
            "&ndash;": "–",
            "&mdash;": "—",
            "&nbsp;": " "
        ]
        
        for (entity, replacement) in entities {
            result = result.replacingOccurrences(of: entity, with: replacement)
        }
        
        return result
    }
    
    // MARK: - Form Update
    private func updateFormFields(companyName: String?, position: String?, location: String?, salary: String?, jobType: String?, workMode: String?) {
        // Update Company Name
        if let company = companyName, !company.isEmpty {
            companyTextField.text = company
        }
        
        // Update Position
        if let pos = position, !pos.isEmpty {
            positionTextField.text = pos
        }
        
        // Update Location
        if let loc = location, !loc.isEmpty {
            locationTextField.text = loc
        }
        
        // Update Salary
        if let sal = salary, !sal.isEmpty {
            parseSalaryRange(sal)
        }
        
        // Update Job Type Segment
        if let jt = jobType {
            let jobTypeLower = jt.lowercased()
            if jobTypeLower.contains("full") {
                jobTypeSegment.selectedSegmentIndex = 0
            } else if jobTypeLower.contains("part") {
                jobTypeSegment.selectedSegmentIndex = 1
            } else if jobTypeLower.contains("contract") {
                jobTypeSegment.selectedSegmentIndex = 2
            } else if jobTypeLower.contains("intern") {
                jobTypeSegment.selectedSegmentIndex = 3
            }
        }
        
        // Update Work Mode Segment
        if let wm = workMode {
            let workModeLower = wm.lowercased()
            if workModeLower.contains("remote") {
                workModeSegment.selectedSegmentIndex = 0
            } else if workModeLower.contains("hybrid") {
                workModeSegment.selectedSegmentIndex = 1
            } else if workModeLower.contains("on-site") || workModeLower.contains("onsite") {
                workModeSegment.selectedSegmentIndex = 2
            }
        }
    }
    
    private func parseSalaryRange(_ salary: String) {
        // Extract numbers from salary string
        // Examples: "$150K/yr - $185K/yr", "$216,300.00/yr - $348,700.00/yr", "$150,000 - $185,000"
        
        let pattern = "\\$([\\d,]+(?:\\.\\d+)?)(K)?(?:/yr)?"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return }
        
        let matches = regex.matches(in: salary, options: [], range: NSRange(location: 0, length: salary.utf16.count))
        
        var salaryValues: [Int] = []
        
        for match in matches {
            if let numberRange = Range(match.range(at: 1), in: salary) {
                var numberStr = String(salary[numberRange])
                numberStr = numberStr.replacingOccurrences(of: ",", with: "")
                
                var value = Double(numberStr) ?? 0
                
                // Check if "K" suffix exists
                if match.range(at: 2).location != NSNotFound, let kRange = Range(match.range(at: 2), in: salary) {
                    let kSuffix = String(salary[kRange])
                    if kSuffix.lowercased() == "k" {
                        value *= 1000
                    }
                }
                
                salaryValues.append(Int(value))
            }
        }
        
        // Set min and max salary fields
        if salaryValues.count >= 1 {
            minSalaryTextField.text = "\(salaryValues[0])"
        }
        if salaryValues.count >= 2 {
            maxSalaryTextField.text = "\(salaryValues[1])"
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
        
        let jobData: [String: Any] = [
            "company_name": company,
            "position": position,
            "job_type": jobTypes[jobTypeSegment.selectedSegmentIndex],
            "work_mode": workModes[workModeSegment.selectedSegmentIndex],
            "min_salary": minSalaryTextField.text ?? "",
            "max_salary": maxSalaryTextField.text ?? "",
            "location": locationTextField.text ?? "",
            "job_url": jobUrlTextField.text ?? "",
            "notes": notesTextView.text ?? "",
            "status": "applied",
            "date_applied": ISO8601DateFormatter().string(from: Date())
        ]
        
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
                    self?.showAlert(title: "Error", message: "Failed to save job: \(error.localizedDescription)")
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    self?.showAlert(title: "Error", message: "Invalid response from server.")
                    return
                }
                
                if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                    // Success - close the extension
                    self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
                } else if httpResponse.statusCode == 401 {
                    self?.showAlert(title: "Session Expired", message: "Please open CareerFlow and log in again.")
                } else {
                    self?.showAlert(title: "Error", message: "Failed to save job. Please try again.")
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
