import type { VaultItemType } from '@ciphervault/contracts'
import { selectableTemplates } from './vault-item-templates'

export function ItemTypeSelector({ onSelect }: { onSelect: (type: VaultItemType) => void }) {
  return <div className="item-type-selector">
    {selectableTemplates.map((template) => {
      const Icon = template.icon
      return <button type="button" key={template.type} onClick={() => onSelect(template.type)}>
        <span><Icon size={19} /></span>
        <b>{template.label}</b>
        <small>{template.description}</small>
      </button>
    })}
  </div>
}
