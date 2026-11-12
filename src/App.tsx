
import { useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import './App.css'

type Player = 'red' | 'blue'
type Phase = Player | 'reveal'
type GameMode = 'local' | 'cpu' | 'online'

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
  const [onlineRole, setOnlineRole] = useState<Player | null>(null)
  const [roomInput, setRoomInput] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [onlineStatus, setOnlineStatus] = useState('対戦方法を選んでください')
  const peerRef = useRef<Peer | null>(null)
  const connectionRef = useRef<DataConnection | null>(null)
  const pendingRemoteCard = useRef<number | null>(null)
  const redSelectedRef = useRef<number | null>(null)
  const onlineRoleRef = useRef<Player | null>(null)
  const resolveRef = useRef<(red: number, blue: number) => void>(() => {})
  const nextRoundRef = useRef<() => void>(() => {})

  useEffect(() => () => {
    connectionRef.current?.close()
    peerRef.current?.destroy()
  }, [])

  function sendOnline(message: Record<string, unknown>) {
    if (connectionRef.current?.open) connectionRef.current.send(message)
  }

  function startOnlineGame() {
    resetGame()
    setStarted(true)
    sendOnline({ type: 'start' })
  }

  function createRoom() {
    connectionRef.current?.close()
    peerRef.current?.destroy()
    const code = Math.random().toString(36).slice(2, 7).toUpperCase()
    const peer = new Peer(`rrivals-${code}`)
    peerRef.current = peer
    setRoomCode(code)
    setOnlineRole('red')
    setOnlineStatus('相手の参加を待っています')
    peer.on('open', () => setOnlineStatus('部屋を作成しました。コードを相手に共有してください'))
    peer.on('connection', connection => {
      connectionRef.current = connection
      connection.on('open', () => setOnlineStatus('相手が参加しました。対戦を始められます'))
      connection.on('data', data => {
        const msg = data as { type?: string; card?: number; action?: string }
        if (msg.type === 'start') { resetGame(); setStarted(true) }
        if ((msg.type === 'play' || msg.type === 'blue-play') && typeof msg.card === 'number') {
          pendingRemoteCard.current = msg.card
          setBlueSelected(msg.card)
          if (onlineRoleRef.current === 'red' && redSelectedRef.current !== null) {
            resolveRef.current(redSelectedRef.current, msg.card)
          } else if (onlineRoleRef.current === 'red') {
            setPhase('red')
          }
        }
        if (msg.type === 'red-play' && typeof msg.card === 'number' && onlineRoleRef.current === 'blue') {
          setRedSelected(msg.card)
          setPhase('blue')
        }
        if (msg.type === 'state' && onlineRoleRef.current === 'blue') {
          const s = msg as unknown as { redSelected:number|null; blueSelected:number|null; redUsed:number[]; blueUsed:number[]; redWins:number; blueWins:number; pendingWins:number; round:number; redBoost:boolean; blueBoost:boolean; phase:Phase; firstPlayer:Player; forcedFirst:Player|null; resultMessage:string; gameOver:boolean }
          setRedSelected(s.redSelected); setBlueSelected(s.blueSelected); setRedUsed(s.redUsed); setBlueUsed(s.blueUsed); setRedWins(s.redWins); setBlueWins(s.blueWins); setPendingWins(s.pendingWins); setRound(s.round); setRedBoost(s.redBoost); setBlueBoost(s.blueBoost); setPhase(s.phase); setFirstPlayer(s.firstPlayer); setForcedFirst(s.forcedFirst); setResultMessage(s.resultMessage); setGameOver(s.gameOver)
        }
        if (msg.type === 'next' && onlineRoleRef.current === 'red') nextRoundRef.current()
      })
      connection.on('close', () => setOnlineStatus('相手との接続が切れました'))
    })
    peer.on('error', err => setOnlineStatus(`接続エラー: ${err.type}。部屋を作り直してください`))
  }

  function joinRoom() {
    const code = roomInput.trim().toUpperCase()
    if (!/^[A-Z0-9]{5}$/.test(code)) { setOnlineStatus('5文字の部屋コードを入力してください'); return }
    connectionRef.current?.close()
    peerRef.current?.destroy()
    const peer = new Peer()
    peerRef.current = peer
    setOnlineRole('blue')
    setOnlineStatus('部屋に接続しています…')
    peer.on('open', () => {
      const connection = peer.connect(`rrivals-${code}`, { reliable: true })
      connectionRef.current = connection
      connection.on('open', () => setOnlineStatus('接続しました。ホストが対戦を開始するまでお待ちください'))
      connection.on('data', data => {
        const msg = data as { type?: string; card?: number }
        if (msg.type === 'start') { resetGame(); setStarted(true) }
        if (msg.type === 'red-play' && typeof msg.card === 'number') { setRedSelected(msg.card); setPhase('blue') }
        if (msg.type === 'state') {
          const s = msg as unknown as { redSelected:number|null; blueSelected:number|null; redUsed:number[]; blueUsed:number[]; redWins:number; blueWins:number; pendingWins:number; round:number; redBoost:boolean; blueBoost:boolean; phase:Phase; firstPlayer:Player; forcedFirst:Player|null; resultMessage:string; gameOver:boolean }
          setRedSelected(s.redSelected); setBlueSelected(s.blueSelected); setRedUsed(s.redUsed); setBlueUsed(s.blueUsed); setRedWins(s.redWins); setBlueWins(s.blueWins); setPendingWins(s.pendingWins); setRound(s.round); setRedBoost(s.redBoost); setBlueBoost(s.blueBoost); setPhase(s.phase); setFirstPlayer(s.firstPlayer); setForcedFirst(s.forcedFirst); setResultMessage(s.resultMessage); setGameOver(s.gameOver)
        }
      })
      connection.on('error', () => setOnlineStatus('部屋に接続できません。コードを確認してください'))
      connection.on('close', () => setOnlineStatus('ホストとの接続が切れました'))
    })
    peer.on('error', () => setOnlineStatus('接続できませんでした。コードを確認して再度お試しください'))
  }
  const [phase, setPhase] = useState<Phase>('red')
  const [firstPlayer, setFirstPlayer] = useState<Player>('red')
  // 密偵で発生する、次の勝負1回だけの先出し強要。
  const [forcedFirst, setForcedFirst] = useState<Player | null>(null)

  const [redSelected, setRedSelected] = useState<number | null>(null)
  const [blueSelected, setBlueSelected] = useState<number | null>(null)
  useEffect(() => { redSelectedRef.current = redSelected }, [redSelected])
  useEffect(() => { onlineRoleRef.current = onlineRole }, [onlineRole])

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
  const firstPlayedCard = phase === 'red' && blueSelected !== null
    ? { card: blueCard, side: 'blue' as const, label: gameMode === 'cpu' ? 'CPUが先に出したカード' : '青が先に出したカード' }
    : phase === 'blue' && redSelected !== null
      ? { card: redCard, side: 'red' as const, label: '赤が先に出したカード' }
      : null

  function resetGame() {
    setPhase('red')
    setFirstPlayer('red')
    setForcedFirst(null)

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
      if (gameMode === 'online' && onlineRole === 'red') sendOnline({ type: 'state', redSelected: null, blueSelected: null, redUsed: [], blueUsed: [], redWins: 0, blueWins: 0, pendingWins: 0, round: 1, redBoost: false, blueBoost: false, phase: 'red', firstPlayer: 'red', forcedFirst: null, resultMessage: '', gameOver: false })
      return
    }

    setRedSelected(null)
    // 通常ラウンドは赤（CPU戦ではプレイヤー）が選び、密偵が発動した場合だけ
    // 次の1回に相手を先出しにする。
    const openingPlayer = forcedFirst ?? 'red'
    setForcedFirst(null) // 密偵の効果は次の勝負1回で消費する
    const cpuStarts = gameMode === 'cpu' && openingPlayer === 'blue'
    // CPU先出し時はカードを表にしてから、プレイヤーに選択させる。
    setBlueSelected(cpuStarts ? chooseCpuOpeningCard() : null)

    setPhase(gameMode === 'cpu' ? 'red' : openingPlayer)
    setRound(round + 1)
    setResultMessage('')
    if (gameMode === 'online' && onlineRole === 'red') {
      sendOnline({ type: 'state', redSelected: null, blueSelected: null, redUsed, blueUsed, redWins, blueWins, pendingWins, round: round + 1, redBoost, blueBoost, phase: openingPlayer, firstPlayer, forcedFirst: null, resultMessage: '', gameOver: false })
    }
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

    // 密偵：出された側を次の1回だけ先出しにする。
    const redSpyActive =
      redNumber === 2 && !redBlocked

    const blueSpyActive =
      blueNumber === 2 && !blueBlocked

    let nextForcedFirst: Player | null = null

    if (redSpyActive && !blueSpyActive) {
      nextForcedFirst = 'blue'
    } else if (blueSpyActive && !redSpyActive) {
      nextForcedFirst = 'red'
    }

    const nextDefaultFirstPlayer: Player = 'red'
    setFirstPlayer(nextDefaultFirstPlayer)
    setForcedFirst(nextForcedFirst)

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

    if (redSpyActive && !blueSpyActive) {
      message += ' 密偵発動！相手は次の勝負で先にカードを出します（先出し強要）。'
    } else if (blueSpyActive && !redSpyActive) {
      message += ' 密偵発動！相手は次の勝負で先にカードを出します（先出し強要）。'
    } else if (redSpyActive && blueSpyActive) {
      message += ' 密偵が同時に発動し、先出し強要は相殺されました。'
    }

    setResultMessage(message)
    setGameOver(finished)
    setPhase('reveal')
    if (gameMode === 'online' && onlineRole === 'red') {
      sendOnline({ type: 'state', redSelected: redNumber, blueSelected: blueNumber, redUsed: [...redUsed, redNumber], blueUsed: [...blueUsed, blueNumber], redWins: newRedWins, blueWins: newBlueWins, pendingWins: newPendingWins, round, redBoost: redNumber === 6 && !redBlocked, blueBoost: blueNumber === 6 && !blueBlocked, phase: 'reveal', firstPlayer: nextDefaultFirstPlayer, forcedFirst: nextForcedFirst, resultMessage: message, gameOver: finished })
    }
  }

  useEffect(() => { resolveRef.current = resolveCards; nextRoundRef.current = nextRound })

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

  function chooseCpuOpeningCard() {
    const available = characters.filter(card => !blueUsed.includes(card.number))
    return available[Math.floor(Math.random() * available.length)].number
  }

  function confirmCard() {
    if (phase === 'reveal') return

    if (gameMode === 'online') {
      if (onlineRole === 'red' && phase === 'red' && redSelected !== null) {
        if (blueSelected !== null) {
          resolveCards(redSelected, blueSelected)
        } else {
          setPhase('blue')
          sendOnline({ type: 'red-play', card: redSelected })
        }
        return
      }
      if (onlineRole === 'blue' && phase === 'blue' && blueSelected !== null) {
        const selectingFirst = redSelected === null
        sendOnline({ type: selectingFirst ? 'blue-play' : 'play', card: blueSelected })
        if (selectingFirst) setPhase('red')
        setOnlineStatus(selectingFirst ? 'カードを送りました。相手の選択を待っています' : 'カードを送信しました。結果を待っています')
        return
      }
      return
    }

    if (phase === 'red' && gameMode === 'cpu') {
      if (redSelected === null) return
      const cpuCard = blueSelected ?? chooseCpuCard(redSelected)
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
              <button className={gameMode === 'local' ? 'mode-button active' : 'mode-button'} onClick={() => setGameMode('local')}>同じ端末</button>
              <button className={gameMode === 'online' ? 'mode-button active' : 'mode-button'} onClick={() => setGameMode('online')}>オンライン</button>
            </div>
          )}

          {!started && gameMode === 'online' && (
            <div className="online-lobby">
              <button className="mode-button" onClick={createRoom}>対戦部屋を作る</button>
              {roomCode && <p className="hint">部屋コード：<strong>{roomCode}</strong></p>}
              <p className="hint">{onlineStatus}</p>
              <div className="join-room">
                <input aria-label="部屋コード" maxLength={5} placeholder="部屋コード" value={roomInput} onChange={e => setRoomInput(e.target.value.toUpperCase())} />
                <button className="mode-button" onClick={joinRoom}>コードで参加</button>
              </div>
            </div>
          )}

          <button
            className="start"
            disabled={!started && gameMode === 'online' && (onlineRole !== 'red' || !connectionRef.current?.open)}
            onClick={() => {
              if (started) {
                setStarted(false)
              } else if (gameMode === 'online') {
                if (onlineRole === 'red' && connectionRef.current?.open) startOnlineGame()
              } else {
                resetGame()
                setStarted(true)
              }
            }}
          >
            {started ? 'カード一覧に戻る' : gameMode === 'online' ? (onlineRole === 'blue' ? 'ホストの開始を待っています' : '対戦を始める') : 'ゲームを始める'}　›
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
              <h2>{gameMode === 'online' && onlineRole === 'blue' ? '🔴 相手がカードを選択中' : '🔴 赤の王国：カード選択'}</h2>
              <p className="hint">
                {gameMode === 'online' && onlineRole === 'blue' ? (blueSelected !== null ? '先に出されたカードが公開されました。相手の選択を待っています' : onlineStatus) : blueSelected !== null ? `${gameMode === 'cpu' ? 'CPU' : '青'}が先にカードを出しました。公開されたカードを見て選んでください` : '使用済みカードは選べません'}
              </p>
            </>
          )}

          {phase === 'blue' && (
            <>
              <h2>{gameMode === 'cpu' ? '🤖 CPUがカードを選択中' : gameMode === 'online' && onlineRole === 'red' ? '🔵 相手がカードを選択中' : '🔵 青の王国：カード選択'}</h2>
              <p className="hint">
                {redSelected !== null ? '赤が先にカードを出しました。公開されたカードを見て選んでください' : gameMode === 'cpu' || (gameMode === 'online' && onlineRole === 'red') ? onlineStatus : '青側のカードを1枚選んでください'}
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

              <button className="confirm" onClick={() => gameMode === 'online' && onlineRole === 'blue' ? sendOnline({ type: 'next' }) : nextRound()}>
                {gameOver ? 'もう一度対戦する' : '次のラウンドへ'}
              </button>
            </>
          )}

          {phase !== 'reveal' && (
            <>
              {firstPlayedCard?.card && (
                <div className="first-play">
                  <p className="hint">{firstPlayedCard.label}（公開）</p>
                  <p className="hint">先に出された数字：<strong style={{ fontSize: '1.6em', color: '#ffe18b' }}>{firstPlayedCard.card.number}</strong></p>
                  <div className={`playing-card ${firstPlayedCard.side}`} style={{ maxWidth: 150, marginInline: 'auto' }}>
                    <span className="number">{firstPlayedCard.card.number}</span>
                    <span className="portrait">{firstPlayedCard.card.symbol}</span>
                    <span className="card-name">{firstPlayedCard.card.name}</span>
                    <CardDescription card={firstPlayedCard.card} />
                    {(firstPlayedCard.side === 'red' ? redBoost : blueBoost) && <span>＋2</span>}
                  </div>
                </div>
              )}
              {(gameMode !== 'online' || (phase === 'red' && onlineRole === 'red') || (phase === 'blue' && onlineRole === 'blue')) && <div className="hand">
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
              </div>}

              {gameMode === 'online' && ((onlineRole === 'red' && phase === 'blue') || (onlineRole === 'blue' && phase === 'red')) && <p className="hint">相手のカード選択を待っています…</p>}

              {(gameMode !== 'online' || (phase === 'red' && onlineRole === 'red') || (phase === 'blue' && onlineRole === 'blue')) && <button
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
              </button>}
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

