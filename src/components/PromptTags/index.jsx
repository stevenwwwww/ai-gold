import { View, Text, ScrollView } from '@tarojs/components'
import { PROMPT_TEMPLATES } from '@/constants/prompts'
import './index.scss'

const tags = Object.entries(PROMPT_TEMPLATES).map(([key, val]) => ({
  key,
  ...val
}))

export default function PromptTags({ onSelect, disabled }) {
  return (
    <ScrollView scrollX className="prompt-tags-scroll">
      <View className="prompt-tags">
        {tags.map((tag) => (
          <View
            key={tag.key}
            className={`prompt-tag ${disabled ? 'disabled' : ''}`}
            onClick={() => !disabled && onSelect?.(tag.key)}
          >
            <Text className="prompt-tag-icon">{tag.icon}</Text>
            <Text className="prompt-tag-label">{tag.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
