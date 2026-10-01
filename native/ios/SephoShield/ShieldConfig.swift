import ManagedSettings
import ManagedSettingsUI
import UIKit

class ShieldConfig: ShieldConfigurationDataSource {
  override func configuration(shielding application: Application) -> ShieldConfiguration {
    ShieldConfiguration(
      backgroundBlurStyle: .systemUltraThinMaterialDark,
      backgroundColor: UIColor.black,
      title: ShieldConfiguration.Label(text: "Paused", color: .white),
      subtitle: ShieldConfiguration.Label(text: "Open Sepho to continue. Phone and Messages stay available.", color: .lightGray),
      primaryButtonLabel: ShieldConfiguration.Label(text: "Open Sepho", color: .white),
      primaryButtonBackgroundColor: UIColor.darkGray
    )
  }
}
