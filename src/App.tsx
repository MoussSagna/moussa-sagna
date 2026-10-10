import { useCallback, useState } from 'react'
import { StageScreen } from './components/StageScreen'
import type { StageOptions } from './game/types'

const prefersCalm = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function App() {
  const [options, setOptions] = useState<StageOptions>({ rain: true, petals: true, calm: prefersCalm })
  const [introKey, setIntroKey] = useState(0)
  const [note, setNote] = useState('Bouge la souris sur le décor pour sentir la profondeur.')

  const onUnavailable = useCallback(() => {
    setNote("Le décor animé n'a pas pu se charger : il reste fixe, seules la pluie et les pétales bougent.")
  }, [])
  const toggle = (key: keyof StageOptions) => setOptions((current) => ({ ...current, [key]: !current[key] }))

  return (
    <main className="mx-auto flex max-w-[1500px] flex-col gap-3.5 px-4 pt-4 pb-8">
      <h1 className="sr-only">Moussa Sagna, développeur frontend</h1>
      <StageScreen options={options} introKey={introKey} onUnavailable={onUnavailable} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
        <button
          type="button"
          onClick={() => setIntroKey((key) => key + 1)}
          className="min-h-11 -skew-x-[10deg] cursor-pointer bg-blood px-5 font-display text-[17px] tracking-wide text-white uppercase italic hover:bg-[#ff3d44]"
        >
          Rejouer l'intro
        </button>
        <Toggle label="Pluie" checked={options.rain} onChange={() => toggle('rain')} />
        <Toggle label="Pétales" checked={options.petals} onChange={() => toggle('petals')} />
        <Toggle label="Réduire les mouvements" checked={options.calm} onChange={() => toggle('calm')} />
        <p className="m-0 text-[15px]">{note}</p>
      </div>
    </main>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-[18px] accent-blood" />
      {label}
    </label>
  )
}

export default App
