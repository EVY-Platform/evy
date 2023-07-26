//
//  ViewController.swift
//  frodo
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import UIKit

final class ViewController: UIViewController, URLSessionWebSocketDelegate {

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        
        FWebsocket.shared.login()
    }
}

