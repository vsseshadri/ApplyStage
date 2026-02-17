//
//  ShareDataBridge.swift
//  CareerFlowApplicationTracker
//
//  Native module to bridge Share Extension data to React Native
//

import Foundation
import React

@objc(ShareDataBridge)
class ShareDataBridge: RCTEventEmitter {
    
    private let appGroupId = "group.com.vsseshadri.careerflow"
    private let sharedKey = "SharedJobData"
    
    override init() {
        super.init()
    }
    
    @objc override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onShareReceived"]
    }
    
    /// Called from React Native to check for shared data
    @objc func getSharedData(_ resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            resolve(nil)
            return
        }
        
        if let sharedData = userDefaults.dictionary(forKey: sharedKey) {
            // Clear after reading
            userDefaults.removeObject(forKey: sharedKey)
            userDefaults.synchronize()
            
            // Convert to format React Native expects
            let result: [String: Any] = [
                "url": sharedData["url"] as? String ?? "",
                "text": sharedData["text"] as? String ?? "",
                "timestamp": sharedData["timestamp"] as? Double ?? Date().timeIntervalSince1970
            ]
            
            resolve(result)
        } else {
            resolve(nil)
        }
    }
    
    /// Called from React Native to clear shared data
    @objc func clearSharedData(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            resolve(false)
            return
        }
        
        userDefaults.removeObject(forKey: sharedKey)
        userDefaults.synchronize()
        resolve(true)
    }
    
    /// Check if there's pending shared data
    @objc func hasSharedData(_ resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            resolve(false)
            return
        }
        
        let hasData = userDefaults.dictionary(forKey: sharedKey) != nil
        resolve(hasData)
    }
}
