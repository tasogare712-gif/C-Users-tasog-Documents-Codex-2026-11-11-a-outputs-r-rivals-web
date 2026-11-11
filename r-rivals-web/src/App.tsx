
import { useState } from 'react'
import './App.css'

type Player = 'red' | 'blue'
type Phase = Player | 'reveal'
type GameMode = 'local' | 'cpu'

type Character = {
  number: number
  name: string
  symbol: string
  color: string
  description: string
}

const characters: Character[] = [
  { number: 0, name: '道化', symbol: '♟', color: 'joker', description: '今回の対決を引き分けにする' },
  { number: 1, name: '姫', symbol: '♕', color: 'princess', description: '王子に勝つと即時ゲーム勝利' },
  { number: 2, name: '密偵', symbol: '◈', color: 'spy', description: '次のラウンドは相手が先に選ぶ' },
  { number: 3, name: '暗殺者', symbol: '⚔', color: 'assassin', description: '数字の強弱を逆転させる' },
  { number: 4, name: '大臣', symbol: '♜', color: 'minister', description: '勝利すると追加で1勝を獲得' },
  { number: 5, name: '魔術師', symbol: '✧', color: 'mage', description: '相手のカード能力を無効化' },
  { number: 6, name: '将軍', symbol: '♞', color: 'general', description: '次の自分のカードに＋2' },
  { number: 7, name: '王子', symbol: '♛', color: 'prince', description: '暗殺者の能力を無効化' },
]

function CardDescription({ card }: { card?: Character }) {
  if (!card) return null

  return (
    <span
      className="card-description"
      style={{
        display: 'block',
        fontSize: 'clamp(11px, 2.5vw, 14px)',
        lineHeight: 1.4,
        textAlign: 'center',
        marginTop: '8px',
        padding: '0 5px',
        overflowWrap: 'anywhere',
        fontWeight: 400,
      }}
    >
      {card.description}
    </span>
  )
}

function App() {
  const [started, setStarted] = useState(false)
  const [gameMode, setGameMode] = useState<GameMode>('cpu')
  const [phase, setPhase] = useState<Phase>('red')
  const [firstPlayer, setFirstPlayer] = useState<Player>('red')

  const [redSelected, setRedSelected] = useState<number | null>(null)
  const [blueSelected, setBlueSelected] = useState<number | null>(null)

  const [redUsed, setRedUsed] = useState<number[]>([])
  const [blueUsed, setBlueUsed] = useState<number[]>([])

  const [redWins, setRedWins] = useState(0)
  const [blueWins, setBlueWins] = useState(0)
  const [pendingWins, setPendingWins] = useState(0)
  const [round, setRound] = useState(1)

  const [redBoost, setRedBoost] = useState(false)
  const [blueBoost, setBlueBoost] = useState(false)

  const [resultMessage, setResultMessage] = useState('')
  const [gameOver, setGameOver] = useState(false)

  const redCard = characters.find(c => c.number === redSelected)
  const blueCard = characters.find(c => c.number === blueSelected)

  function resetGame() {
    setPhase('red')
    setFirstPlayer('red')

    setRedSelected(null)
    setBlueSelected(null)

    setRedUsed([])
    setBlueUsed([])

    setRedWins(0)
    setBlueWins(0)
    setPendingWins(0)

    setRedBoost(false)
    setBlueBoost(false)

    setRound(1)
    setResultMessage('')
    setGameOver(false)
  }

  function nextRound() {
    if (gameOver) {
      resetGame()
      return
    }

    setRedSelected(null)
    setBlueSelected(null)

    setPhase(gameMode === 'cpu' ? 'red' : firstPlayer)
    setRound(round + 1)
    setResultMessage('')
  }

  function resolveCards(redNumber: number, blueNumber: number) {

    let newRedWins = redWins
    let newBlueWins = blueWins
    let newPendingWins = pendingWins

    let message = ''
    let finished = false

    const redBlocked = blueNumber === 5
    const blueBlocked = redNumber === 5

    const redAssassinActive =
      redNumber === 3 &&
      !redBlocked &&
      blueNumber !== 7

    const blueAssassinActive =
      blueNumber === 3 &&
      !blueBlocked &&
      redNumber !== 7

    // 姫の特殊勝利
    if (redNumber === 1 && blueNumber === 7) {
      newRedWins = 4
      message = '姫の特殊能力発動！赤の王国の即時勝利！'
      finished = true
    } else if (blueNumber === 1 && redNumber === 7) {
      newBlueWins = 4
      message = '姫の特殊能力発動！青の王国の即時勝利！'
      finished = true
    } else {
      const redPower = redNumber + (redBoost ? 2 : 0)
      const bluePower = blueNumber + (blueBoost ? 2 : 0)

      const reverse =
        redAssassinActive || blueAssassinActive

      let winner: Player | null = null

      // 道化の能力：どちらかが道化なら必ず引き分け
      if (redNumber === 0 || blueNumber === 0) {
        winner = null
        message = '道化の能力発動！今回の対決は引き分け！'
      } else if (redPower === bluePower) {
        winner = null
      } else if (reverse) {
        winner = redPower < bluePower ? 'red' : 'blue'
      } else {
        winner = redPower > bluePower ? 'red' : 'blue'
      }

      if (winner === null) {
        newPendingWins += 1

        if (!message) {
          message = '引き分け！'
        }

        message += ` ${newPendingWins}勝分を次の勝負へ持ち越します`
      } else {
        const winnerNumber =
          winner === 'red' ? redNumber : blueNumber

        const winnerBlocked =
          winner === 'red' ? redBlocked : blueBlocked

        const ministerBonus =
          winnerNumber === 4 && !winnerBlocked ? 1 : 0

        const gained =
          1 + newPendingWins + ministerBonus

        if (winner === 'red') {
          newRedWins += gained
          message = `🔴 赤の王国が${gained}勝分を獲得！`
        } else {
          newBlueWins += gained
          message = `🔵 青の王国が${gained}勝分を獲得！`
        }

        newPendingWins = 0

        if (ministerBonus > 0) {
          message += ' 大臣の追加勝利！'
        }
      }
    }

    setRedWins(newRedWins)
    setBlueWins(newBlueWins)
    setPendingWins(newPendingWins)

    // 将軍：次のラウンドのカードに＋2
    setRedBoost(redNumber === 6 && !redBlocked)
    setBlueBoost(blueNumber === 6 && !blueBlocked)

    // 密偵：次のラウンドの先手を相手にする
    const redSpyActive =
      redNumber === 2 && !redBlocked

    const blueSpyActive =
      blueNumber === 2 && !blueBlocked

    let nextFirstPlayer: Player

    if (redSpyActive && !blueSpyActive) {
      nextFirstPlayer = 'blue'
    } else if (blueSpyActive && !redSpyActive) {
      nextFirstPlayer = 'red'
    } else {
      nextFirstPlayer =
        firstPlayer === 'red' ? 'blue' : 'red'
    }

    setFirstPlayer(nextFirstPlayer)

    // 使用済みカードを記録
    setRedUsed([...redUsed, redNumber])
    setBlueUsed([...blueUsed, blueNumber])

    // ゲーム終了判定
    if (newRedWins >= 4) {
      message += ' 赤の王国がゲーム優勝！'
      finished = true
    } else if (newBlueWins >= 4) {
      message += ' 青の王国がゲーム優勝！'
      finished = true
    } else if (redUsed.length + 1 >= 8) {
      message += ' 8ラウンド終了！ゲームは引き分けです。'
      finished = true
    }

    // 能力発動の表示
    if (redAssassinActive || blueAssassinActive) {
      message += ' 暗殺者の効果発動！'
    }

    if (redNumber === 7 && blueNumber === 3) {
      message += ' 王子が暗殺者を無効化！'
    }

    if (blueNumber === 7 && redNumber === 3) {
      message += ' 王子が暗殺者を無効化！'
    }

    if (
      (redNumber === 5 && blueNumber !== 5) ||
      (blueNumber === 5 && redNumber !== 5)
    ) {
      message += ' 魔術師が相手の能力を無効化！'
    }

    if (redNumber === 6 && !redBlocked) {
      message += ' 赤の将軍が次のカードを強化！'
    }

    if (blueNumber === 6 && !blueBlocked) {
      message += ' 青の将軍が次のカードを強化！'
    }

    if (redSpyActive || blueSpyActive) {
      message += ' 密偵の効果で次の先手が変わります！'
    }

    setResultMessage(message)
    setGameOver(finished)
    setPhase('reveal')
  }

  function chooseCpuCard(redNumber: number) {
    const available = characters.filter(card => !blueUsed.includes(card.number))
    // 相手の選択を読めないため、残りカードの強さと特殊能力を見て選びます。
    const redBoosted = redBoost
    const scored = available.map(card => {
      let score = card.number
      if (card.number === 0) score = redNumber >= 5 ? 5.5 : 2.5
      if (card.number === 1 && redNumber === 7) score = 20
      if (card.number === 3) score += redNumber !== 7 ? 1.5 : -2
      if (card.number === 4) score += 0.8
      if (card.number === 5) score += redNumber === 4 || redNumber === 6 ? 2 : 0.3
      if (card.number === 6 && !blueBoost) score -= 0.4
      if (card.number === 7 && redNumber === 1) score = -5
      if (redBoosted) score -= 0.25
      return { number: card.number, score }
    })
    const bestScore = Math.max(...scored.map(card => card.score))
    const best = scored.filter(card => card.score >= bestScore - 0.8)
    return best[Math.floor(Math.random() * best.length)].number
  }

  function confirmCard() {
    if (phase === 'reveal') return

    if (phase === 'red' && gameMode === 'cpu') {
      if (redSelected === null) return
      const cpuCard = chooseCpuCard(redSelected)
      setBlueSelected(cpuCard)
      resolveCards(redSelected, cpuCard)
      return
    }

    if (redSelected === null || blueSelected === null) {
      setPhase(phase === 'red' ? 'blue' : 'red')
      return
    }

    resolveCards(redSelected, blueSelected)
  }

  return (
    <main className="game">
      <header className="hero">
        <div className="brand">
          <div className="crown">♛</div>
          <h1>R-Rivals</h1>
          <p>アールライバルズ</p>
          <div className="ornament">✦ ━━━━━━━━━ ✦</div>
          <h2>運命を賭けた、王位争奪戦。</h2>
          <p className="subtitle">
            2人対戦の心理戦カードゲーム
          </p>

          {!started && (
            <div className="mode-picker" aria-label="対戦モード">
              <button className={gameMode === 'cpu' ? 'mode-button active' : 'mode-button'} onClick={() => setGameMode('cpu')}>CPU対戦</button>
              <button className={gameMode === 'local' ? 'mode-button active' : 'mode-button'} onClick={() => setGameMode('local')}>2人対戦</button>
            </div>
          )}

          <button
            className="start"
            onClick={() => {
              if (started) {
                setStarted(false)
              } else {
                resetGame()
                setStarted(true)
              }
            }}
          >
            {started ? 'カード一覧に戻る' : 'ゲームを始める'}　›
          </button>
        </div>

        <div className="castle">
          <div className="castle-sun">☼</div>
          <div className="castle-title">THE ROYAL BATTLE</div>
          <div className="castle-crown">♛</div>
          <div className="castle-bottom">
            KINGDOM OF TWO RIVALS
          </div>
        </div>
      </header>

      {started ? (
        <section className="battle">
          <div className="score">
            <div className="player red-player">
              🔴 赤の王国 <b>{redWins} 勝</b>
            </div>

            <div className="round">ROUND {round}</div>

            <div className="player blue-player">
              {gameMode === 'cpu' ? '🤖 CPU' : '🔵 青の王国'} <b>{blueWins} 勝</b>
            </div>
          </div>

          <p className="hint">
            持ち越しポイント：{pendingWins} 勝分
          </p>

          {redBoost && (
            <p className="hint">🔴 赤：将軍の＋2効果が有効</p>
          )}

          {blueBoost && (
            <p className="hint">🔵 青：将軍の＋2効果が有効</p>
          )}

          {phase === 'red' && (
            <>
              <h2>🔴 赤の王国：カード選択</h2>
              <p className="hint">
                使用済みカードは選べません
              </p>
            </>
          )}

          {phase === 'blue' && (
            <>
              <h2>{gameMode === 'cpu' ? '🤖 CPUがカードを選択中' : '🔵 青の王国：カード選択'}</h2>
              <p className="hint">
                {gameMode === 'cpu' ? 'CPUの選択を待っています' : '青側のカードを1枚選んでください'}
              </p>
            </>
          )}

          {phase === 'reveal' && (
            <>
              <h2>⚔️ カード公開！</h2>

              <div className="hand reveal-hand">
                <div className="playing-card red">
                  <span className="number">{redCard?.number}</span>
                  <span className="portrait">{redCard?.symbol}</span>
                  <span className="card-name">{redCard?.name}</span>
                  <CardDescription card={redCard} />
                  {redBoost && <span>＋2</span>}
                </div>

                <div className="playing-card blue">
                  <span className="number">{blueCard?.number}</span>
                  <span className="portrait">{blueCard?.symbol}</span>
                  <span className="card-name">{blueCard?.name}</span>
                  <CardDescription card={blueCard} />
                  {blueBoost && <span>＋2</span>}
                </div>
              </div>

              <h2>{resultMessage}</h2>

              <p className="hint">
                現在のスコア：赤 {redWins} 勝 ／ 青 {blueWins} 勝
              </p>

              <button className="confirm" onClick={nextRound}>
                {gameOver ? 'もう一度対戦する' : '次のラウンドへ'}
              </button>
            </>
          )}

          {phase !== 'reveal' && (
            <>
              <div className="hand">
                {characters.map(card => {
                  const selected =
                    phase === 'red'
                      ? redSelected
                      : blueSelected

                  const used =
                    phase === 'red'
                      ? redUsed.includes(card.number)
                      : blueUsed.includes(card.number)

                  return (
                    <button
                      key={card.number}
                      disabled={used}
                      className={`playing-card ${
                        phase === 'red' ? 'red' : 'blue'
                      } ${
                        selected === card.number ? 'chosen' : ''
                      }`}
                      style={{
                        opacity: used ? 0.3 : 1,
                        filter: used ? 'grayscale(1)' : 'none',
                      }}
                      onClick={() => {
                        if (phase === 'red') {
                          setRedSelected(card.number)
                        } else {
                          setBlueSelected(card.number)
                        }
                      }}
                    >
                      <span className="number">{card.number}</span>
                      <span className="portrait">{card.symbol}</span>
                      <span className="card-name">{card.name}</span>
                      <CardDescription card={card} />
                      {used && <span>使用済み</span>}
                    </button>
                  )
                })}
              </div>

              <button
                className="confirm"
                disabled={
                  phase === 'red'
                    ? redSelected === null
                    : blueSelected === null
                }
                onClick={confirmCard}
              >
                {phase === 'red'
                  ? (gameMode === 'cpu' ? 'カードを出してCPUと対戦' : '赤のカードを確定')
                  : '青のカードを確定'}
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="collection">
          <div className="kingdom red-heading">
            ♛ 赤の王国　8枚
          </div>

          <div className="cards">
            {characters.map(card => (
              <div className="card red" key={card.number}>
                <span className="number">{card.number}</span>
                <div className={`portrait ${card.color}`}>
                  {card.symbol}
                </div>
                <div className="card-name">{card.name}</div>
                <CardDescription card={card} />
              </div>
            ))}
          </div>

          <div className="kingdom blue-heading">
            ♛ 青の王国　8枚
          </div>

          <div className="cards">
            {characters.map(card => (
              <div className="card blue" key={card.number}>
                <span className="number">{card.number}</span>
                <div className={`portrait ${card.color}`}>
                  {card.symbol}
                </div>
                <div className="card-name">{card.name}</div>
                <CardDescription card={card} />
              </div>
            ))}
          </div>
        </section>
      )}

      <footer>
        <span>♛ R-RIVALS</span>
        <span>16 CARDS · 2 PLAYERS · ONE THRONE</span>
        <span>© R-Rivals Prototype</span>
      </footer>
    </main>
  )
}

export default App

