//
//  ViewController.swift
//  frodo
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import UIKit

final class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        Task {
            await setup()
            await loadData()
        }
    }
    
    func setup() async {
        do {
            try await FManager.shared.setup()
        } catch (FWSError.loginError) {
            print("Could not log in")
        } catch {
            print("Unexpected error: \(error).")
        }
    }
    
    func loadData() async {
        do {
            let data = try await FManager.shared.fetchServicesData()
            print(data)
        } catch {
            print("Unexpected error: \(error).")
        }
    }
}

