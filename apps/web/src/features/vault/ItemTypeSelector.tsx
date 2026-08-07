import type { VaultItemType } from '@keywall/contracts'
import { selectableTemplates } from './vault-item-templates'

export function ItemTypeSelector({ onSelect }: { onSelect: (type: VaultItemType) => void }) {
  return (
    <div className="item-type-selector">
      {selectableTemplates.map((template) => {
        const Icon = template.icon
        return (
          <button
            type="button"
            key={template.type}
            className="item-type-option"
            onClick={() => onSelect(template.type)}
          >
            <span className="type-icon-wrapper">
              <Icon size={18} />
            </span>
            <div className="type-meta">
              <b className="type-title">{template.label}</b>
              <small className="type-desc">{template.description}</small>
            </div>
          </button>
        )
      })}
    </div>
  )
}

