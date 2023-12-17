//
//  EVYCarouselIndicator.swift
//  frodo
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import SwiftUI

struct EVYCarouselIndicator: View {
    let indices: ClosedRange<Int>
    let selectionIndex: Int
    let color: Color
    
    var body: some View {
        HStack {
            ForEach(indices, id: \.self) { index in
                Capsule()
                    .fill(color.opacity(selectionIndex == index ? 1 : 0.33))
                    .frame(width: 35, height: 8)
            }
        }
        .padding()
    }
}

#Preview {
    EVYCarouselIndicator(indices: (1...3), selectionIndex: 2, color: .black)
}
