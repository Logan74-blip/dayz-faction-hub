import { useState } from 'react'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const SECTIONS = [
  {
    category: '🚀 Getting Started',
    color: 'var(--green)',
    items: [
      {
        title: 'How do I create a faction?',
        content: `Go to the Home page (Dashboard). If you're not in a faction yet, you'll see a text field asking for a faction name. Type your faction name and click "Create Faction". You'll automatically become the Leader. This only takes a few seconds.`
      },
      {
        title: 'How do I invite members to my faction?',
        content: `Go to Settings → scroll down to find the Invite Link section. Click "Generate Invite Link" to create a shareable link. Copy the link and share it in your Discord server. When someone clicks the link and logs in with Discord, they'll automatically join your faction as a Member.`
      },
      {
        title: 'How do I join an existing faction?',
        content: `You have two options:\n\n1. Ask the faction leader to send you an invite link — click it and you'll join automatically.\n\n2. Go to Join Requests in the Community menu. Browse recruiting factions, click Apply, write a short intro about yourself and submit. The faction leader will review and accept or decline your application.`
      },
      {
        title: 'What are the different member roles?',
        content: `👑 Leader — Full control. Can do everything including disbanding the faction, changing settings, and transferring leadership.\n\n⭐ Co-Leader — Can manage raids, diplomacy, announcements, kick members and send invites.\n\n📋 Recruiter — Can send invite links and review join requests.\n\n👤 Member — Can view everything and RSVP to raids. Cannot post announcements or manage members.`
      },
      {
        title: 'How do I change a member\'s role?',
        content: `Go to Settings → scroll to the Members section. Find the member you want to promote or demote and use the role dropdown next to their name. Only Leaders and Co-Leaders can change roles. To transfer leadership entirely, select "Leader" from the dropdown — you'll be demoted to Co-Leader automatically.`
      },
    ]
  },
  {
    category: '⚔️ Operations',
    color: 'var(--red)',
    items: [
      {
        title: 'How do I schedule a raid?',
        content: `Go to Operations → Raids. Click "Schedule Raid" (Leaders and Co-Leaders only). Fill in the operation name, target location, date/time and a briefing. Click Create Operation. All faction members will receive a notification. Members can RSVP by clicking the RSVP button on the raid card.`
      },
      {
        title: 'What are raid templates?',
        content: `When creating a raid, if you have a common operation you run repeatedly (like a specific base or route), click "Save as Template" after filling in the details. Next time you create a raid, your templates appear at the top — click one to pre-fill the form instantly.`
      },
      {
        title: 'How do I log a raid debrief?',
        content: `After a raid's scheduled time passes, it moves to Past Operations. Click "Debrief" on any past raid to log the outcome (Success, Partial, Failed, Aborted), casualty count, loot summary, notes and a star rating. This data feeds into your faction stats and event log.`
      },
      {
        title: 'How do I use the War Room?',
        content: `Go to Operations → War Room. This shows all your active wars declared through the Diplomacy Board. Click a war to open the engagement log — you can add entries for each skirmish, raid or encounter. When the war ends, click "End War" and select the outcome (Won, Lost, Draw, Abandoned).`
      },
      {
        title: 'How do I use the War Map?',
        content: `Go to Operations → War Map. Select your map (Chernarus, Livonia or Sakhal) and toggle between standard and topographic views. Click anywhere on the map to drop a marker. Give it a name and type (Base, Patrol, Enemy, Loot, Danger). Markers are saved and visible to all faction members.`
      },
      {
        title: 'How do I post a bounty?',
        content: `Go to Operations → Bounties. Click "Post Bounty". Enter the target's name, the reward (items, in-game currency, etc.) and a description. Set the status to Active. Members can see and claim bounties. Leaders can mark bounties as completed when collected.`
      },
    ]
  },
  {
    category: '💰 Economy',
    color: 'var(--yellow)',
    items: [
      {
        title: 'How does the Resource Stockpile work?',
        content: `Go to Economy → Resources. Add items manually by typing the name, selecting a category and quantity. Items with the same name and category automatically stack — no duplicates. Use the +/- buttons to adjust quantities. The screenshot scanner (camera icon) can detect DayZ items from inventory screenshots using OCR.`
      },
      {
        title: 'How do I use the screenshot scanner?',
        content: `In Resources, click the "Scan Screenshot" button. Upload a screenshot of your DayZ inventory. The scanner uses OCR to detect item names and quantities automatically. Review the detected items, adjust quantities if needed, check/uncheck items to import, then click Import. Items will stack with existing stockpile entries.`
      },
      {
        title: 'How does the Treasury work?',
        content: `Go to Economy → Treasury. Log every item that enters or leaves the faction stash using Deposit and Withdrawal transactions. The Current Stock panel shows your net inventory by calculating deposits minus withdrawals. The transaction log on the right shows full history with who logged each entry and when.`
      },
      {
        title: 'How do I use the Trading Post?',
        content: `Go to Economy → Trading Post. Post trade listings for items you want to offer or items you're looking for. Other factions can browse listings and send offers. You'll receive a notification when someone makes an offer. Accept or decline through the Trading Post page.`
      },
    ]
  },
  {
    category: '🤝 Diplomacy',
    color: '#818cf8',
    items: [
      {
        title: 'How do I send a diplomacy proposal?',
        content: `Go to Diplomacy → Diplomacy Board. Click "New Proposal". Select the type (Non-Aggression Pact, War Declaration, or Trade Agreement), choose the target faction, add terms/notes and send. The other faction's leadership will receive a notification and can accept or decline.`
      },
      {
        title: 'What is a Non-Aggression Pact (NAP)?',
        content: `A NAP is a formal agreement between two factions to not attack each other. Once both sides accept, the alliance shows on the Alliance Network map and both faction profiles. NAPs can be cancelled through the Diplomacy Board.`
      },
      {
        title: 'How do I declare war on another faction?',
        content: `Go to Diplomacy → Diplomacy Board. Click "New Proposal" → select "War Declaration" → choose the target faction. Once sent, the war becomes active immediately — you don't need the other faction to accept. The war appears in your War Room where you can log engagements.`
      },
      {
        title: 'How do cross-faction messages work?',
        content: `Go to Diplomacy → Messages. You can send messages to any faction on the platform. The receiving faction's leadership will see the message and can reply. This is useful for negotiating trades, diplomacy terms or coordinating on shared servers.`
      },
      {
        title: 'What is the Alliance Network?',
        content: `Go to Diplomacy → Alliance Network. This shows a visual map of all faction relationships — green lines for NAPs, red dashed lines for wars, yellow lines for trade agreements. Your faction is highlighted. It gives you a quick overview of the political landscape on your server.`
      },
    ]
  },
  {
    category: '📊 Intel',
    color: '#60a5fa',
    items: [
      {
        title: 'How do I post an announcement?',
        content: `Go to Intel → Announcements. Click "Post Announcement" (Leaders and Co-Leaders only). Write a title and message body. Optionally pin it — pinned announcements always appear at the top. All members receive a notification when a new announcement is posted. Discord webhook notifications are also sent if configured.`
      },
      {
        title: 'What is the Event Log?',
        content: `Go to Intel → Event Log. This automatically records faction activity — raids scheduled, diplomacy sent, members joining/leaving, announcements posted, treasury transactions and more. Leaders and Co-Leaders can also see the Member Activity tab showing individual member contributions.`
      },
      {
        title: 'How do I use the Server Calendar?',
        content: `Go to Intel → Server Events. This shows community events for your server — server wipes, truces, community raids, trade meets and more. Leaders and Co-Leaders can post events. All factions on the same server can see and post to the same calendar.`
      },
      {
        title: 'What are Faction Logs?',
        content: `Go to Intel → Faction Logs. When a Leader clicks "Start Fresh" on the Dashboard, all operational data is archived here before being cleared. Each log shows a snapshot of your faction's stats at that moment — members, raids, resources, bounties and recent activity. These logs are permanent and cannot be deleted.`
      },
    ]
  },
  {
    category: '🌐 Community',
    color: 'var(--green)',
    items: [
      {
        title: 'How does the Server Directory work?',
        content: `Go to Community → Directory. All factions are listed grouped by server. Click a server to expand and see all factions on it. You can search by faction name, tag, server name or leader username. Filter by recruiting status or server type (Official/Community). Click "View" to see a faction's full profile or "Request" to apply.`
      },
      {
        title: 'How does the Leaderboard work?',
        content: `Go to Community → Leaderboard. Factions are ranked across four categories — Members, Territories, Raids and Alliances. Click the category tabs to switch rankings. Your faction is highlighted. The leaderboard auto-refreshes every 60 seconds and can be manually refreshed.`
      },
      {
        title: 'What are Achievements?',
        content: `Achievements are automatically unlocked when your faction hits milestones — like getting 10 members, completing your first raid, forming your first alliance or winning a war. They appear on your faction profile. Check Community → Achievements to see all unlocked achievements and what's still locked.`
      },
      {
        title: 'What is the Dead Factions page?',
        content: `Go to Community → Dead Factions. This shows factions where all members have left. Their profiles and logs are preserved permanently so their history isn't lost. Dead factions cannot be joined — they're purely an archive.`
      },
    ]
  },
  {
    category: '⚙️ Settings & Customization',
    color: 'var(--muted)',
    items: [
      {
        title: 'How do I customize my faction colors and flag?',
        content: `Go to Settings → Customize. Choose from preset color themes or pick custom hex colors using the color pickers. Select a flag emoji from the grid — this appears next to your faction name everywhere on the platform. Click "Save Customization" to apply. Changes are visible immediately across the entire app.`
      },
      {
        title: 'How do I set up Discord webhook notifications?',
        content: `Go to Settings → Notification Settings. Paste your Discord webhook URL (create one in your Discord server under Server Settings → Integrations → Webhooks). Enable the notification types you want — raids, bounties, diplomacy, announcements and member joins. Test with a raid or announcement to confirm it's working.`
      },
      {
        title: 'How do I use Start Fresh?',
        content: `On the Dashboard Overview tab, Leaders see a "Start Fresh" button. Click it to archive all operational data (raids, resources, bounties, treasury, announcements, diplomacy) and clear it for a new chapter. Your members and settings are kept. A permanent snapshot is saved to Faction Logs before clearing. You'll be asked to confirm and optionally add a label like "Server Wipe — March 2026".`
      },
      {
        title: 'How do I disband my faction?',
        content: `Go to Settings → scroll to the Danger Zone at the bottom. Click "Disband Faction". You'll be asked to type your faction name to confirm. This removes all members and deletes the faction permanently. This cannot be undone — use Start Fresh instead if you just want to reset operational data.`
      },
      {
        title: 'How do I kick a member?',
        content: `Go to Settings → Members section. Find the member you want to remove and click the kick button (trash icon) next to their name. Leaders can kick anyone. Co-Leaders can kick Members and Recruiters but not other Co-Leaders. A kicked member can rejoin via a new invite link.`
      },
    ]
  },
  {
    category: '🤖 Discord Bot',
    color: '#5865F2',
    items: [
      {
        title: 'How do I set up the Discord bot?',
        content: `The Faction Hub bot needs to be added to your Discord server by the platform administrator. Once added, it registers slash commands automatically. Your Discord account must be linked to Faction Hub (just log in once at dayz-faction-hub.vercel.app) for the bot to recognize you.`
      },
      {
        title: 'What commands does the bot support?',
        content: `/faction — Your faction info, stats and your role\n/raids — Upcoming raids with RSVP counts\n/rsvp — RSVP to the next upcoming raid (or cancel)\n/bounties — Active bounties\n/treasury — Current treasury stock\n/resources — Stockpile summary by category\n/diplomacy — Active pacts and wars\n/members — Member list by role\n/war — Active war status with day counter\n/leaderboard — Server rankings with medals`
      },
      {
        title: 'Why does the bot say my account isn\'t linked?',
        content: `The bot finds you by matching your Discord user ID to your Faction Hub profile. Make sure you've logged into dayz-faction-hub.vercel.app at least once using the same Discord account you're using in the server. If you've done that and still get the error, try logging out and back in on the website.`
      },
    ]
  },
  {
    category: '☢️ Hub Announcements',
    color: 'var(--green)',
    items: [
      {
        title: 'What is the Hub Announcements page?',
        content: `Hub Announcements (the ☢️ Hub tab in the navbar) is the official Faction Hub news feed. Only the platform creator (CIDMAN420) can post here. Everyone else can read and like announcements. Check here for new feature releases, maintenance notices, community news and platform updates.`
      },
      {
        title: 'How do I like an announcement?',
        content: `On the Hub page, each announcement has a heart ❤️ Like button at the bottom right. Click it to like — click again to unlike. The like count shows next to the button.`
      },
    ]
  },
]

export default function Help() {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})
  const [activeCategory, setActiveCategory] = useState('all')
  const navigate = useNavigate()

  function toggle(key) {
    setExpanded(e => ({ ...e, [key]: !e[key] }))
  }

  const filtered = SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item =>
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(section =>
    section.items.length > 0 &&
    (activeCategory === 'all' || section.category === activeCategory)
  )

  const totalItems = SECTIONS.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <div style={{ maxWidth:860, margin:'40px auto', padding:'0 24px', display:'flex', flexDirection:'column', gap:'24px' }}>

      {/* Header */}
      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:'12px' }}>
        <h1 style={{ fontFamily:'Share Tech Mono', fontSize:'28px', color:'var(--green)' }}>
          ☢️ HELP & DOCUMENTATION
        </h1>
        <p style={{ color:'var(--muted)', fontSize:'15px' }}>
          Everything you need to know about Faction Hub — {totalItems} guides across {SECTIONS.length} categories
        </p>

        {/* Search */}
        <div style={{ position:'relative', maxWidth:'500px', margin:'0 auto', width:'100%' }}>
          <Search size={16} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }} />
          <input
            placeholder="Search guides... (e.g. invite, raid, treasury)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft:'40px', fontSize:'15px', width:'100%' }}
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'18px' }}
            >×</button>
          )}
        </div>
      </div>

      {/* Category filter */}
      {!search && (
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', justifyContent:'center' }}>
          <button
            onClick={() => setActiveCategory('all')}
            className="btn"
            style={{ fontSize:'12px', padding:'5px 14px', background: activeCategory==='all' ? 'var(--green-dim)' : 'var(--surface)', color: activeCategory==='all' ? '#fff' : 'var(--muted)', border:'1px solid var(--border)' }}
          >
            All Topics
          </button>
          {SECTIONS.map(s => (
            <button
              key={s.category}
              onClick={() => setActiveCategory(s.category)}
              className="btn"
              style={{ fontSize:'12px', padding:'5px 14px', background: activeCategory===s.category ? `${s.color}33` : 'var(--surface)', color: activeCategory===s.category ? s.color : 'var(--muted)', border:`1px solid ${activeCategory===s.category ? s.color : 'var(--border)'}` }}
            >
              {s.category}
            </button>
          ))}
        </div>
      )}

      {/* Search results count */}
      {search && (
        <p style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center' }}>
          {filtered.reduce((sum, s) => sum + s.items.length, 0)} results for "{search}"
        </p>
      )}

      {/* No results */}
      {filtered.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:'48px', color:'var(--muted)', display:'flex', flexDirection:'column', gap:'12px', alignItems:'center' }}>
          <div style={{ fontSize:'48px' }}>🔍</div>
          <p style={{ fontSize:'15px' }}>No guides found for "{search}"</p>
          <p style={{ fontSize:'13px' }}>Try different keywords or browse by category</p>
          <button className="btn btn-ghost" style={{ fontSize:'13px' }} onClick={() => setSearch('')}>Clear Search</button>
        </div>
      )}

      {/* Sections */}
      {filtered.map(section => (
        <div key={section.category} style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <h2 style={{ fontFamily:'Share Tech Mono', fontSize:'15px', color:section.color, letterSpacing:'0.08em', paddingBottom:'8px', borderBottom:`1px solid ${section.color}33` }}>
            {section.category}
          </h2>
          {section.items.map((item, i) => {
            const key = `${section.category}-${i}`
            const isOpen = expanded[key] || !!search
            return (
              <div key={key} className="card" style={{ padding:'0', overflow:'hidden', borderLeft:`3px solid ${section.color}44`, transition:'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = section.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = `${section.color}44`}
              >
                <button
                  onClick={() => toggle(key)}
                  style={{ width:'100%', background:'transparent', border:'none', cursor:'pointer', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', textAlign:'left' }}
                >
                  <span style={{ fontWeight:700, fontSize:'14px', color:'var(--text)', flex:1 }}>{item.title}</span>
                  {isOpen
                    ? <ChevronUp size={15} color="var(--muted)" style={{ flexShrink:0 }} />
                    : <ChevronDown size={15} color="var(--muted)" style={{ flexShrink:0 }} />
                  }
                </button>
                {isOpen && (
                  <div style={{ padding:'0 18px 16px', borderTop:'1px solid var(--border)' }}>
                    <p style={{ fontSize:'14px', color:'var(--muted)', lineHeight:1.8, whiteSpace:'pre-wrap', marginTop:'12px' }}>
                      {item.content}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Footer */}
      <div className="card" style={{ textAlign:'center', padding:'32px', display:'flex', flexDirection:'column', gap:'12px', alignItems:'center', background:'#0d1a0d', borderColor:'var(--green-dim)' }}>
        <div style={{ fontSize:'32px' }}>☢️</div>
        <p style={{ fontSize:'14px', color:'var(--muted)' }}>
          Still need help? Check the{' '}
          <span style={{ color:'var(--green)', cursor:'pointer' }} onClick={() => navigate('/hub')}>
            Hub Announcements
          </span>{' '}
          for the latest updates or reach out to CIDMAN420 directly on Discord.
        </p>
        <p style={{ fontSize:'12px', color:'var(--muted)' }}>
          Faction Hub v1.0 — Built for DayZ survivors ☢️
        </p>
      </div>
    </div>
  )
}