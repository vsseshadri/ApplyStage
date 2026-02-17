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
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        if let url = data as? URL {
                            DispatchQueue.main.async {
                                self?.sharedUrl = url.absoluteString
                                self?.jobUrlTextField.text = url.absoluteString
                                self?.parseJobDetails(from: url.absoluteString)
                            }
                        }
                    }
                    return
                } else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (data, error) in
                        if let text = data as? String {
                            DispatchQueue.main.async {
                                self?.sharedText = text
                                if let url = self?.extractURL(from: text) {
                                    self?.sharedUrl = url
                                    self?.jobUrlTextField.text = url
                                    self?.parseJobDetails(from: url)
                                }
                                self?.notesTextView.text = text
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
    
    private func parseJobDetails(from url: String) {
        // Parse LinkedIn URL for job details
        let lowercaseUrl = url.lowercased()
        
        // Try to extract company name from URL
        if lowercaseUrl.contains("linkedin.com") {
            // LinkedIn job URLs often have company name in the path
            if let companyMatch = url.range(of: "company/([^/]+)", options: .regularExpression) {
                let company = String(url[companyMatch])
                    .replacingOccurrences(of: "company/", with: "")
                    .replacingOccurrences(of: "-", with: " ")
                    .capitalized
                companyTextField.text = company
            }
        }
        
        // Set default work mode based on content
        if lowercaseUrl.contains("remote") {
            workModeSegment.selectedSegmentIndex = 0
        } else if lowercaseUrl.contains("hybrid") {
            workModeSegment.selectedSegmentIndex = 1
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
