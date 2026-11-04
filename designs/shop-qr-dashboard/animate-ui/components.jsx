import React, {useState} from 'react';
import {AnimateUIProvider} from '@animate-ui/react/provider';
import {ToggleGroup} from '@animate-ui/react/primitives/radix-ui/toggle-group';
import {Dialog} from '@animate-ui/react/primitives/radix-ui/dialog';
import {DropdownMenu} from '@animate-ui/react/primitives/radix-ui/dropdown-menu';

function Icon({kind, ...props}) {
  const paths = {
    download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
    chevron: 'm7 10 5 5 5-5',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    close: 'm6 6 12 12 M6 18 18 6',
    info: 'M12 11v6 M12 7h.01',
    arrow: 'M6 18 18 6 M6 6h12v12',
    file: 'M14 3H5v18h14V8l-5-5Z M14 3v5h5 M8 12h8 M8 16h6',
  };
  return <svg className="sq-icon" viewBox="0 0 24 24" aria-hidden="true" {...props}>{kind==='info' && <circle cx="12" cy="12" r="9"/>}<path d={paths[kind]}/></svg>;
}

// Text comes from templates in files/index.html so the page remains the source of copy.
export function copyFrom(root) {
  const copy = {};
  root.querySelectorAll('#sq-ui-copy').forEach(template => {
    template.content.querySelectorAll('[data-copy]').forEach(node => {copy[node.dataset.copy] = node.textContent;});
  });
  return copy;
}

function htmlToReact(node, key) {
  if(node.nodeType===3) return node.textContent;
  if(node.nodeType!==1) return null;
  const props={key};
  for(const attr of node.attributes) props[attr.name==='class'?'className':attr.name]=attr.value;
  return React.createElement(node.localName,props,...Array.from(node.childNodes,(child,index)=>htmlToReact(child,index)));
}
export function contentFrom(root, id) {
  const template=root.querySelector('#'+id);
  return template ? Array.from(template.content.childNodes,(node,index)=>htmlToReact(node,index)) : null;
}

function Range({range,onRange,copy}) {
  return <ToggleGroup.Root type="single" value={range} onValueChange={value=>{if(value)onRange(value);}} className="sq-range sq-animated-range" aria-label={copy.rangeLabel}>
    <ToggleGroup.Item value="today">{copy.today}</ToggleGroup.Item>
    <ToggleGroup.Item value="7days">{copy.week}</ToggleGroup.Item>
    <ToggleGroup.Item value="month">{copy.month}</ToggleGroup.Item>
  </ToggleGroup.Root>;
}

function Export({onExport,copy,disabled}) {
  const [portal,setPortal]=useState(null);
  return <>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="sq-btn sq-primary sq-export-trigger" disabled={disabled}>
        <Icon kind="download"/>{copy.export}<Icon kind="chevron"/>
      </DropdownMenu.Trigger>
      {portal && <DropdownMenu.Portal container={portal}>
        <DropdownMenu.Content className="sq-popup-menu" align="end" sideOffset={8} collisionPadding={12}>
          <DropdownMenu.Label className="sq-menu-label">{copy.exportLabel}</DropdownMenu.Label>
          <DropdownMenu.Item className="sq-menu-item" onSelect={()=>onExport('csv')}>
            <Icon kind="file"/><span><b>{copy.csv}</b><small>{copy.csvNote}</small></span>
          </DropdownMenu.Item>
          <DropdownMenu.Item className="sq-menu-item" onSelect={()=>onExport('json')}>
            <Icon kind="file"/><span><b>{copy.json}</b><small>{copy.jsonNote}</small></span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="sq-menu-separator"/>
          <p className="sq-menu-foot">{copy.exportNote}</p>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>}
    </DropdownMenu.Root>
    <div ref={setPortal}/>
  </>;
}

function Help({copy,content}) {
  const [portal,setPortal]=useState(null);
  return <>
    <Dialog.Root>
      <Dialog.Trigger className="sq-help-trigger"><Icon kind="info"/><span>{copy.about}</span></Dialog.Trigger>
      {portal && <Dialog.Portal container={portal}>
        <Dialog.Overlay className="sq-dialog-overlay"/>
        <Dialog.Content className="sq-info-dialog" from="bottom">
          <div className="sq-dialog-head"><span className="sq-dialog-symbol"><Icon kind="info"/></span><Dialog.Close className="sq-close-btn" aria-label={copy.close}><Icon kind="close"/></Dialog.Close></div>
          <Dialog.Title className="sq-dialog-title">{copy.infoTitle}</Dialog.Title>
          <Dialog.Description className="sq-dialog-description">{copy.infoDescription}</Dialog.Description>
          <div className="sq-dialog-body">{content}</div>
          <Dialog.Close className="sq-btn sq-primary sq-dialog-confirm">{copy.understood}</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>}
    </Dialog.Root>
    <div ref={setPortal}/>
  </>;
}

function Mobile({copy,links,onNavigate}) {
  const [open,setOpen]=useState(false);
  const [portal,setPortal]=useState(null);
  return <>
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="sq-mobile-trigger" aria-label={copy.openMenu}><Icon kind="menu"/></Dialog.Trigger>
      {portal && <Dialog.Portal container={portal}>
        <Dialog.Overlay className="sq-dialog-overlay"/>
        <Dialog.Content className="sq-mobile-sheet" from="left">
          <div className="sq-sheet-head"><Dialog.Title className="sq-sheet-title">{copy.shopTitle}</Dialog.Title><Dialog.Close className="sq-close-btn" aria-label={copy.closeMenu}><Icon kind="close"/></Dialog.Close></div>
          <Dialog.Description className="sq-sheet-description">{copy.mobileDescription}</Dialog.Description>
          <nav className="sq-sheet-nav" aria-label={copy.mobileNavigation}>
            {links.map(link=><button key={link.href} onClick={()=>{setOpen(false);onNavigate(link.href);}}><span>{link.label}</span><Icon kind="arrow"/></button>)}
          </nav>
          <div className="sq-sheet-note">{copy.sampleNote}</div>
        </Dialog.Content>
      </Dialog.Portal>}
    </Dialog.Root>
    <div ref={setPortal}/>
  </>;
}

const components={range:Range,export:Export,help:Help,mobile:Mobile};
export function PreviewControl({kind,...props}) {
  const Control=components[kind];
  return <AnimateUIProvider tempo={0.85} reducedMotion="user"><Control {...props}/></AnimateUIProvider>;
}
