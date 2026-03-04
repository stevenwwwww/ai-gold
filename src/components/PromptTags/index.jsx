import { View, Text, ScrollView } from '@tarojs/components'
import { PROMPT_TEMPLATES } from '@/constants/prompts'
import './index.scss'

const tags = Object.entries(PROMPT_TEMPLATES).map(([key, val]) => ({
  key,
  ...val
}))

export default function PromptTags({ onSelect, disabled }) {
  return (
    <ScrollView scrollX className="ptags-scroll">
      <View className="ptags-inner">
        {tags.map((tag) => (
          <View
            key={tag.key}
            className={`ptag ${disabled ? 'ptag-disabled' : ''}`}
            onClick={() => !disabled && onSelect?.(tag.key)}
          >
            <Text className="ptag-icon">{tag.icon}</Text>
            <Text className="ptag-label">{tag.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
