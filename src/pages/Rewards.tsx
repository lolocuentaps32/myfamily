import { useState, useEffect, useCallback } from 'react'
import { pb } from '../lib/pb'
import { useActiveFamily } from '../lib/useActiveFamily'
import './Rewards.css'

type PointRecord = {
    id: string
    points: number
    reason: string
    created_at: string
    expand?: {
        created_by_member?: { display_name: string }
    }
}

type Goal = {
    id: string
    title: string
    description: string | null
    points: number
    icon: string
    is_recurring: boolean
    is_active: boolean
}

type RewardItem = {
    id: string
    title: string
    description: string | null
    points_cost: number
    icon: string
    stock: number | null
    is_active: boolean
}

type Redemption = {
    id: string
    points_spent: number
    status: string
    created_at: string
    expand?: {
        reward_item?: { title: string; icon: string }
    }
}

type FeedPost = {
    id: string
    content: string | null
    file: string | null
    created_at: string
    expand?: {
        author?: { display_name: string; avatar: string | null }
        "feed_reactions(feed_item)"?: { emoji: string; member: string }[]
    }
}

type Member = {
    id: string
    display_name: string
    avatar: string | null
}

export default function RewardsPage() {
    const { activeFamilyId, myMember } = useActiveFamily()
    const [activeTab, setActiveTab] = useState<'points' | 'goals' | 'rewards' | 'feed'>('points')

    // Data states
    const [points, setPoints] = useState<PointRecord[]>([])
    const [balance, setBalance] = useState(0)
    const [goals, setGoals] = useState<Goal[]>([])
    const [rewardItems, setRewardItems] = useState<RewardItem[]>([])
    const [redemptions, setRedemptions] = useState<Redemption[]>([])
    const [feed, setFeed] = useState<FeedPost[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

    const [loading, setLoading] = useState(true)

    const isAdult = myMember?.role === 'owner' || myMember?.role === 'admin' || myMember?.role === 'adult'
    const viewingMemberId = selectedMemberId || myMember?.id

    // Load data
    const loadData = useCallback(async () => {
        if (!activeFamilyId) return
        setLoading(true)

        try {
            // Load members
            const membersList = await pb.collection('members').getFullList<Member>({
                filter: `id != ""`, // dummy to get all
            })
            // Actually, members should be filtered by family.
            // Supabase used .eq('family_id', activeFamilyId) on members table?
            // Wait, my members table has members... but families are linked via family_members.
            const fmList = await pb.collection('family_members').getFullList({
                filter: `family = "${activeFamilyId}"`,
                expand: 'member'
            })
            const membersData = fmList.map((f: any) => ({
                id: f.member,
                display_name: f.expand?.member?.display_name ?? 'Miembro',
                avatar: f.expand?.member?.avatar ?? null,
                collectionId: f.expand?.member?.collectionId,
                collectionName: f.expand?.member?.collectionName
            }))
            setMembers(membersData as any)

            // Load points for selected member
            if (viewingMemberId) {
                const pointsList = await pb.collection('reward_points').getList<any>(1, 50, {
                    filter: `family = "${activeFamilyId}" && member = "${viewingMemberId}"`,
                    sort: '-created_at',
                    expand: 'created_by_member'
                })
                setPoints(pointsList.items)

                // Calculate balance manually
                const allPoints = await pb.collection('reward_points').getFullList({
                    filter: `family = "${activeFamilyId}" && member = "${viewingMemberId}"`
                })
                const total = allPoints.reduce((acc, p) => acc + (p.points || 0), 0)
                setBalance(total)
            }

            // Load goals
            const goalsList = await pb.collection('reward_goals').getFullList<Goal>({
                filter: `family = "${activeFamilyId}" && is_active = true`,
                sort: 'title'
            })
            setGoals(goalsList)

            // Load reward items
            const itemsList = await pb.collection('reward_items').getFullList<RewardItem>({
                filter: `family = "${activeFamilyId}" && is_active = true`,
                sort: 'points_cost'
            })
            setRewardItems(itemsList)

            // Load redemptions
            if (viewingMemberId) {
                const redemptionsList = await pb.collection('reward_redemptions').getList<any>(1, 20, {
                    filter: `family = "${activeFamilyId}" && member = "${viewingMemberId}"`,
                    sort: '-created_at',
                    expand: 'reward_item'
                })
                setRedemptions(redemptionsList.items)
            }

            // Load feed
            const feedList = await pb.collection('family_feed').getList<any>(1, 30, {
                filter: `family = "${activeFamilyId}"`,
                sort: '-is_pinned,-created_at',
                expand: 'author,feed_reactions(feed_item)'
            })
            setFeed(feedList.items)

        } catch (err) {
            console.error('Error loading rewards data:', err)
        } finally {
            setLoading(false)
        }
    }, [activeFamilyId, viewingMemberId])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Complete a goal (add points)
    async function completeGoal(goal: Goal) {
        if (!activeFamilyId || !viewingMemberId) return

        try {
            await pb.collection('reward_points').create({
                family: activeFamilyId,
                member: viewingMemberId,
                points: goal.points,
                reason: `Completado: ${goal.title}`,
                goal: goal.id,
                created_by_member: myMember?.id
            })

            // Create feed post
            await pb.collection('family_feed').create({
                family: activeFamilyId,
                author: viewingMemberId,
                content: `🎉 ¡Completó "${goal.title}" y ganó ${goal.points} puntos!`
            })
            loadData()
        } catch (err) {
            console.error('Error completing goal:', err)
        }
    }

    // Redeem a reward
    async function redeemReward(item: RewardItem) {
        if (!activeFamilyId || !viewingMemberId) return
        if (balance < item.points_cost) {
            alert('No tienes suficientes puntos')
            return
        }

        try {
            // Deduct points (insert negative record)
            await pb.collection('reward_points').create({
                family: activeFamilyId,
                member: viewingMemberId,
                points: -item.points_cost,
                reason: `Canje: ${item.title}`,
                created_by_member: myMember?.id
            })

            // Create redemption
            await pb.collection('reward_redemptions').create({
                family: activeFamilyId,
                member: viewingMemberId,
                reward_item: item.id,
                points_spent: item.points_cost,
                status: 'pending'
            })

            await pb.collection('family_feed').create({
                family: activeFamilyId,
                author: viewingMemberId,
                content: `🎁 ¡Canjeó "${item.title}" por ${item.points_cost} puntos!`
            })
            loadData()
        } catch (err) {
            console.error('Error redeeming reward:', err)
        }
    }

    // Approve redemption
    async function approveRedemption(redemption: Redemption, status: 'approved' | 'rejected') {
        try {
            await pb.collection('reward_redemptions').update(redemption.id, {
                status,
                approved_by: myMember?.id,
                approved_at: new Date().toISOString()
            })
            loadData()
        } catch (err) {
            console.error('Error approving redemption:', err)
        }
    }

    // Add reaction to feed post
    async function toggleReaction(post: FeedPost, emoji: string) {
        if (!myMember) return

        const reactions = post.expand?.['feed_reactions(feed_item)'] || []
        const existingReaction = reactions.find(r => r.member === myMember.id && r.emoji === emoji)

        try {
            if (existingReaction) {
                // PocketBase doesn't support easy delete by filter in SDK without ID
                // I need the reaction ID. Let's fix type and expansion.
                const fullPost = await pb.collection('family_feed').getOne(post.id, {
                    expand: 'feed_reactions(feed_item)'
                })
                const rToDel = (fullPost.expand?.['feed_reactions(feed_item)'] || []).find((r: any) => r.member === myMember.id && r.emoji === emoji)
                if (rToDel) {
                    await pb.collection('feed_reactions').delete(rToDel.id)
                }
            } else {
                await pb.collection('feed_reactions').create({
                    feed_item: post.id,
                    member: myMember.id,
                    emoji
                })
            }
            loadData()
        } catch (err) {
            console.error('Error toggling reaction:', err)
        }
    }

    function formatDate(iso: string) {
        const date = new Date(iso)
        const now = new Date()
        const diff = now.getTime() - date.getTime()

        if (diff < 60000) return 'Ahora'
        if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`
        if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    }

    if (loading) {
        return (
            <div className="page rewards-page">
                <div className="loading-spinner">Cargando...</div>
            </div>
        )
    }

    return (
        <div className="page rewards-page">
            {/* Balance Header */}
            <div className="rewards-header">
                <div className="balance-card">
                    <span className="balance-icon">⭐</span>
                    <div className="balance-info">
                        <span className="balance-label">Mi Balance</span>
                        <span className="balance-value">{balance} puntos</span>
                    </div>
                </div>

                {isAdult && (
                    <select
                        className="member-selector"
                        value={selectedMemberId || ''}
                        onChange={(e) => setSelectedMemberId(e.target.value || null)}
                    >
                        <option value="">Mi vista</option>
                        {members.map(m => (
                            <option key={m.id} value={m.id}>{m.display_name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Tabs */}
            <div className="rewards-tabs">
                {[
                    { id: 'points', label: 'Puntos', icon: '⭐' },
                    { id: 'goals', label: 'Metas', icon: '🎯' },
                    { id: 'rewards', label: 'Premios', icon: '🎁' },
                    { id: 'feed', label: 'Feed', icon: '📣' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`rewards-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id as any)}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="rewards-content">
                {/* Points Tab */}
                {activeTab === 'points' && (
                    <div className="points-section">
                        <h3>📊 Historial de Puntos</h3>
                        {points.length === 0 ? (
                            <p className="empty-state">No hay puntos registrados aún</p>
                        ) : (
                            <div className="points-list">
                                {points.map(p => (
                                    <div key={p.id} className={`point-card ${p.points >= 0 ? 'positive' : 'negative'}`}>
                                        <div className="point-amount">{p.points >= 0 ? '+' : ''}{p.points}</div>
                                        <div className="point-info">
                                            <div className="point-reason">{p.reason}</div>
                                            <div className="point-meta">
                                                {formatDate(p.created_at)}
                                                {p.expand?.created_by_member && ` • por ${p.expand.created_by_member.display_name}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Goals Tab */}
                {activeTab === 'goals' && (
                    <div className="goals-section">
                        <h3>🎯 Metas Activas</h3>
                        {goals.length === 0 ? (
                            <p className="empty-state">No hay metas definidas. {isAdult && 'Usa "+ Añadir" para crear una.'}</p>
                        ) : (
                            <div className="goals-grid">
                                {goals.map(g => (
                                    <div key={g.id} className="goal-card">
                                        <span className="goal-icon">{g.icon}</span>
                                        <div className="goal-info">
                                            <div className="goal-title">{g.title}</div>
                                            {g.description && <div className="goal-desc">{g.description}</div>}
                                            <div className="goal-points">+{g.points} puntos</div>
                                        </div>
                                        <button
                                            className="btn-complete"
                                            onClick={() => completeGoal(g)}
                                        >
                                            ✓ Hecho
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Rewards Tab */}
                {activeTab === 'rewards' && (
                    <div className="rewards-section">
                        <h3>🎁 Premios Canjeables</h3>
                        {rewardItems.length === 0 ? (
                            <p className="empty-state">No hay premios disponibles. {isAdult && 'Usa "+ Añadir" para crear uno.'}</p>
                        ) : (
                            <div className="rewards-grid">
                                {rewardItems.map(item => (
                                    <div key={item.id} className={`reward-item-card ${balance >= item.points_cost ? 'available' : 'locked'}`}>
                                        <span className="reward-icon">{item.icon}</span>
                                        <div className="reward-info">
                                            <div className="reward-title">{item.title}</div>
                                            {item.description && <div className="reward-desc">{item.description}</div>}
                                            <div className="reward-cost">{item.points_cost} puntos</div>
                                        </div>
                                        <button
                                            className="btn-redeem"
                                            disabled={balance < item.points_cost}
                                            onClick={() => redeemReward(item)}
                                        >
                                            🎁 Canjear
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pending Redemptions */}
                        {redemptions.filter(r => r.status === 'pending').length > 0 && (
                            <>
                                <h3>⏳ Canjes Pendientes</h3>
                                <div className="redemptions-list">
                                    {redemptions.filter(r => r.status === 'pending').map(r => (
                                        <div key={r.id} className="redemption-card pending">
                                            <span className="redemption-icon">{r.expand?.reward_item?.icon || '🎁'}</span>
                                            <div className="redemption-info">
                                                <div className="redemption-title">{r.expand?.reward_item?.title}</div>
                                                <div className="redemption-meta">{formatDate(r.created_at)}</div>
                                            </div>
                                            {isAdult && (
                                                <div className="redemption-actions">
                                                    <button className="btn-approve" onClick={() => approveRedemption(r, 'approved')}>✓</button>
                                                    <button className="btn-reject" onClick={() => approveRedemption(r, 'rejected')}>✕</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Feed Tab */}
                {activeTab === 'feed' && (
                    <div className="feed-section">
                        <h3>📣 Feed Familiar</h3>
                        {feed.length === 0 ? (
                            <p className="empty-state">No hay publicaciones aún</p>
                        ) : (
                            <div className="feed-list">
                                {feed.map(post => (
                                    <div key={post.id} className="feed-post">
                                        <div className="feed-author">
                                            <div className="feed-avatar">
                                                {post.expand?.author?.avatar ? (
                                                    <img src={pb.files.getUrl(post.expand.author as any, post.expand.author.avatar)} alt="" />
                                                ) : (
                                                    '👤'
                                                )}
                                            </div>
                                            <div className="feed-author-info">
                                                <span className="feed-author-name">{post.expand?.author?.display_name || 'Familia'}</span>
                                                <span className="feed-time">{formatDate(post.created_at)}</span>
                                            </div>
                                        </div>

                                        {post.content && <p className="feed-content">{post.content}</p>}

                                        {post.file && (
                                            <div className="feed-media">
                                                <img src={pb.files.getUrl(post, post.file)} alt="" className="feed-image" />
                                            </div>
                                        )}

                                        <div className="feed-reactions">
                                            {['❤️', '👏', '🎉', '⭐'].map(emoji => {
                                                const postReactions = post.expand?.['feed_reactions(feed_item)'] || []
                                                const count = postReactions.filter(r => r.emoji === emoji).length
                                                const myReaction = postReactions.find(r => r.member === myMember?.id && r.emoji === emoji)
                                                return (
                                                    <button
                                                        key={emoji}
                                                        className={`reaction-btn ${myReaction ? 'active' : ''}`}
                                                        onClick={() => toggleReaction(post, emoji)}
                                                    >
                                                        {emoji} {count > 0 && <span className="reaction-count">{count}</span>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
