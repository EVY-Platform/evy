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
        message()
    }
    
    func message() {
        let auth = FLoginParams(token: "clem", os: FOS.android)

        Task {
            do {
                let res = try await FWebsocket.shared(auth: auth).callAPI(method: "sum", params: nil, expecting: String.self)
                print(res)
            } catch (FWSError.loginError) {
                print("Could not log in")
            } catch {
                print("Unexpected error: \(error).")
            }
        }
    }
}

