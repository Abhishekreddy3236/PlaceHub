import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { ListNode, ListItemNode, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND, $createListNode, $createListItemNode, $isListNode, $isListItemNode } from '@lexical/list';
import { LinkNode, TOGGLE_LINK_COMMAND, $isLinkNode, $createLinkNode } from '@lexical/link';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_STAR,
  ITALIC_STAR,
  UNORDERED_LIST,
  LINK,
} from '@lexical/markdown';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { FORMAT_TEXT_COMMAND, $getSelection, $setSelection, $isRangeSelection, TextNode, ParagraphNode, COMMAND_PRIORITY_HIGH, PASTE_COMMAND, $insertNodes, $createParagraphNode, $createTextNode, createEditor, $getRoot, $isTextNode, $isParagraphNode, CLICK_COMMAND } from 'lexical';
import toast from 'react-hot-toast';
import { HiOutlineLink, HiOutlineX } from 'react-icons/hi';

const EMPTY_PARAGRAPH_TRANSFORMER = {
  dependencies: [ParagraphNode],
  export: (node, exportChildren) => {
    if (node.isEmpty()) {
      return '\n\u200B\n';
    }
    return null;
  },
  replace: () => false,
  type: 'element',
};

const PLACEHUB_TRANSFORMERS = [EMPTY_PARAGRAPH_TRANSFORMER, BOLD_STAR, ITALIC_STAR, UNORDERED_LIST, LINK];

const theme = {
  text: {
    bold: 'font-bold',
    italic: 'italic',
  },
  list: {
    ul: 'list-disc list-outside ml-5 space-y-1 mb-2',
    listitem: 'pl-1',
  },
  link: 'text-blue-600 hover:underline cursor-pointer',
  paragraph: 'mb-2 last:mb-0',
};

function ToolbarPlugin({ linkPopoverState, setLinkPopoverState }) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isBullet, setIsBullet] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));

      const node = selection.anchor.getNode();
      const parent = node.getParent();

      const isLinkNode = $isLinkNode(parent) || $isLinkNode(node);
      setIsLink(isLinkNode);

      let currentParent = node.getParent();
      let isBulletList = false;
      while (currentParent) {
        if (currentParent.__type === 'list' && currentParent.__listType === 'bullet') {
          isBulletList = true;
          break;
        }
        currentParent = currentParent.getParent();
      }
      setIsBullet(isBulletList);
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => updateToolbar());
    });
  }, [editor, updateToolbar]);

  const handleLinkClick = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!selection || !$isRangeSelection(selection)) return;

      let linkUrl = '';
      let isEdit = false;
      let linkText = '';

      const node = selection.anchor.getNode();
      const parent = node.getParent();

      if ($isLinkNode(parent)) {
        linkUrl = parent.getURL();
        isEdit = true;
        linkText = parent.getTextContent();
      } else if ($isLinkNode(node)) {
        linkUrl = node.getURL();
        isEdit = true;
        linkText = node.getTextContent();
      } else {
        linkText = selection.getTextContent();
        const trimmed = linkText.trim();
        if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
          linkUrl = trimmed;
        }
      }

      setLinkPopoverState({
        isOpen: true,
        url: linkUrl,
        displayText: linkText,
        isExistingLink: isEdit,
        savedSelection: selection.clone()
      });
    });
  };

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5 border border-slate-200">
      <button
        type="button"
        onClick={() => { editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'); editor.focus(); }}
        className={`p-1.5 rounded transition-colors ${isBold ? 'bg-slate-300 text-slate-900' : 'text-slate-600 hover:bg-slate-200'}`}
        title="Bold"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.6 11.8c1-.7 1.6-1.8 1.6-3 0-2.6-2.1-4.8-4.8-4.8H7v16h6.1c2.8 0 5.1-2.3 5.1-5.1 0-1.5-.7-2.8-1.8-3.1zM10 6.5h2.1c1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2H10V6.5zm2.7 11H10v-4.6h2.7c1.3 0 2.4 1.1 2.4 2.4s-1.1 2.2-2.4 2.2z" /></svg>
      </button>
      <button
        type="button"
        onClick={() => { editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'); editor.focus(); }}
        className={`p-1.5 rounded transition-colors ${isItalic ? 'bg-slate-300 text-slate-900' : 'text-slate-600 hover:bg-slate-200'}`}
        title="Italic"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 5v3h2.2l-3.4 8H6v3h8v-3h-2.2l3.4-8H18V5h-8z" /></svg>
      </button>
      <button
        type="button"
        onClick={handleLinkClick}
        className={`p-1.5 rounded transition-colors ${isLink ? 'bg-slate-300 text-slate-900' : 'text-slate-600 hover:bg-slate-200'}`}
        title="Link"
      >
        <HiOutlineLink className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          if (isBullet) {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          } else {
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          }
          editor.focus();
        }}
        className={`p-1.5 rounded transition-colors ${isBullet ? 'bg-slate-300 text-slate-900' : 'text-slate-600 hover:bg-slate-200'}`}
        title="Bullet list"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
      </button>
    </div>
  );
}

function LinkPopoverPlugin({ linkPopoverState, setLinkPopoverState }) {
  const [editor] = useLexicalComposerContext();
  const inputRef = useRef(null);

  useEffect(() => {
    if (linkPopoverState.isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [linkPopoverState.isOpen]);

  if (!linkPopoverState.isOpen) return null;

  const handleApply = () => {
    let finalUrl = linkPopoverState.url.trim();
    if (!finalUrl) {
      toast.error('Please enter a URL');
      return;
    }
    if (finalUrl.startsWith('www.')) {
      finalUrl = 'https://' + finalUrl;
    } else if (!finalUrl.startsWith('https://')) {
      toast.error('Only https:// links are allowed for security');
      return;
    }

    let textChanged = false;

    editor.update(() => {
      if (linkPopoverState.savedSelection) {
        $setSelection(linkPopoverState.savedSelection.clone());
      }
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const textToInsert = linkPopoverState.displayText?.trim() || finalUrl;

        const node = selection.anchor.getNode();
        const parent = node.getParent();
        const linkNode = $isLinkNode(parent) ? parent : $isLinkNode(node) ? node : null;

        if (linkNode) {
          if (linkNode.getTextContent() !== textToInsert || linkNode.getURL() !== finalUrl) {
            const firstChild = linkNode.getFirstChild();
            const format = $isTextNode(firstChild) ? firstChild.getFormat() : 0;

            const newLinkNode = $createLinkNode(finalUrl);
            const newTextNode = $createTextNode(textToInsert);
            newTextNode.setFormat(format);
            newLinkNode.append(newTextNode);

            linkNode.replace(newLinkNode);
            newTextNode.select();
            textChanged = true;
          }
        } else {
          if (selection.getTextContent() !== textToInsert) {
            const nodes = selection.getNodes();
            let format = 0;
            if (nodes.length > 0 && $isTextNode(nodes[0])) {
              format = nodes[0].getFormat();
            }
            const newLinkNode = $createLinkNode(finalUrl);
            const textNode = $createTextNode(textToInsert);
            textNode.setFormat(format);
            newLinkNode.append(textNode);
            selection.insertNodes([newLinkNode]);
            textChanged = true;
          }
        }
      }
    });

    if (!textChanged) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, finalUrl);
    }

    setLinkPopoverState({ ...linkPopoverState, isOpen: false });
    editor.getRootElement()?.focus({ preventScroll: true });
  };

  const handleRemove = () => {
    editor.update(() => {
      if (linkPopoverState.savedSelection) {
        $setSelection(linkPopoverState.savedSelection.clone());
      }
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    });
    setLinkPopoverState({ ...linkPopoverState, isOpen: false });
    editor.getRootElement()?.focus({ preventScroll: true });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setLinkPopoverState({ ...linkPopoverState, isOpen: false });
      editor.getRootElement()?.focus({ preventScroll: true });
    }
  };

  return (
    <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1 w-full sm:w-[90vw] sm:max-w-sm bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-10 flex flex-col gap-3 font-sans">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Display text</label>
        <input
          type="text"
          value={linkPopoverState.displayText || ''}
          onChange={(e) => setLinkPopoverState({ ...linkPopoverState, displayText: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Text to display"
          className="w-full input text-sm py-1.5 px-2 mb-2"
          aria-label="Display text"
        />
        <label className="block text-xs font-semibold text-slate-600 mb-1">Link URL</label>
        <input
          ref={inputRef}
          type="text"
          value={linkPopoverState.url}
          onChange={(e) => setLinkPopoverState({ ...linkPopoverState, url: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com"
          className="w-full input text-sm py-1.5 px-2"
          aria-label="Link URL"
        />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2">
        <div className="text-[11px] text-slate-500 font-medium">
          Ctrl + Click to open <span className="font-normal text-slate-400">(Mac: Cmd + Click)</span>
        </div>
        <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
          {linkPopoverState.isExistingLink && (
            <button type="button" onClick={handleRemove} className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 mr-auto sm:mr-0 flex items-center gap-1">
              Remove link
            </button>
          )}
          <button type="button" onClick={() => {
            setLinkPopoverState({ ...linkPopoverState, isOpen: false });
            editor.getRootElement()?.focus({ preventScroll: true });
          }} className="text-xs font-medium text-slate-600 hover:text-slate-800 px-2 py-1 ml-auto sm:ml-0">
            Cancel
          </button>
          <button type="button" onClick={handleApply} className="text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 px-3 py-1.5">
            {linkPopoverState.isExistingLink ? 'Apply' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkClickVerificationPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return false;
        }

        const link = target.closest('a');
        const isModifier = event.ctrlKey || event.metaKey;

        if (!isModifier) {
          if (link) {
            event.preventDefault();
          }
          return false;
        }

        if (link) {
          const href = link.getAttribute('href');
          if (href && href.startsWith('https://')) {
            window.open(href, '_blank', 'noopener,noreferrer');
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}

function MarkdownInitPlugin({ initialMarkdown }) {
  const [editor] = useLexicalComposerContext();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && initialMarkdown !== undefined) {
      editor.update(() => {
        $convertFromMarkdownString(initialMarkdown || '', PLACEHUB_TRANSFORMERS);
      });
      initialized.current = true;
    }
  }, [editor, initialMarkdown]);

  return null;
}

function extractData(node) {
  const data = { type: node.__type };
  if ($isTextNode(node)) {
    data.text = node.getTextContent();
    data.format = node.getFormat();
    data.style = node.getStyle();
    data.mode = node.getMode();
    data.detail = node.getDetail();
  } else if ($isLinkNode(node)) {
    data.url = node.getURL();
    data.target = typeof node.getTarget === 'function' ? node.getTarget() : undefined;
    data.rel = typeof node.getRel === 'function' ? node.getRel() : undefined;
    data.title = typeof node.getTitle === 'function' ? node.getTitle() : undefined;
  } else if ($isListNode(node)) {
    data.listType = node.getListType();
    data.start = node.getStart();
  } else if ($isListItemNode(node)) {
    data.value = node.getValue();
    data.checked = node.getChecked();
  } else if ($isParagraphNode(node)) {
    data.format = node.getFormat();
    data.indent = node.getIndent();
  }
  if (typeof node.getChildren === 'function') {
    data.children = node.getChildren().map(extractData);
  }
  return data;
}

function buildNodes(data) {
  let node;
  if (data.type === 'text') {
    node = $createTextNode(data.text);
    node.setFormat(data.format);
    if (data.style) node.setStyle(data.style);
    node.setDetail(data.detail);
    node.setMode(data.mode);
  } else if (data.type === 'link') {
    let finalUrl = (data.url || '').trim();
    if (finalUrl.startsWith('www.')) finalUrl = 'https://' + finalUrl;

    if (finalUrl && !finalUrl.startsWith('https://')) {
      let labelText = '';
      if (data.children) {
        data.children.forEach(c => {
          if (c.type === 'text') labelText += c.text || '';
        });
      }
      return $createTextNode(labelText);
    }

    node = $createLinkNode(finalUrl, { target: data.target, rel: data.rel, title: data.title });
  } else if (data.type === 'list') {
    node = $createListNode(data.listType, data.start);
  } else if (data.type === 'listitem') {
    node = $createListItemNode(data.value, data.checked);
  } else {
    node = $createParagraphNode();
    if (data.format) node.setFormat(data.format);
    if (data.indent) node.setIndent(data.indent);
  }

  if (data.children) {
    data.children.forEach(childData => {
      const childNode = buildNodes(childData);
      if (childNode) {
        node.append(childNode);
      }
    });
  }
  return node;
}

function MarkdownPastePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const clipboardData = event.clipboardData || window.clipboardData;
        const text = clipboardData.getData('text/plain');

        if (!text) return false;

        const containsMarkdown = (str) => {
          if (/^-\s/m.test(str)) return true;
          const regex = /(\*\*\*([^\s*](?:.*?[^\s*])?)\*\*\*)|(\*\*([^\s*](?:[^*]*?[^\s*])?)\*\*)|(\*([^\s*](?:[^*]*?[^\s*])?)\*)|(\[[^\]]+\]\(https?:\/\/[^\s)]+\))/;
          return regex.test(str);
        };

        if (containsMarkdown(text)) {
          event.preventDefault();

          let parsedData = [];
          const tempEditor = createEditor({
            nodes: [ListNode, ListItemNode, LinkNode, ParagraphNode, TextNode],
            theme: editor._config.theme
          });

          tempEditor.update(() => {
            $convertFromMarkdownString(text, PLACEHUB_TRANSFORMERS);
          }, { discrete: true });

          tempEditor.getEditorState().read(() => {
            const root = $getRoot();
            parsedData = root.getChildren().map(extractData);
          });

          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const nodes = parsedData.map(buildNodes);
              $insertNodes(nodes);
            }
          });

          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}

function EditorToolbar() {
  const [linkPopoverState, setLinkPopoverState] = useState({
    isOpen: false,
    url: '',
    displayText: '',
    isExistingLink: false,
  });

  return (
    <div className="relative">
      <ToolbarPlugin linkPopoverState={linkPopoverState} setLinkPopoverState={setLinkPopoverState} />
      <LinkPopoverPlugin linkPopoverState={linkPopoverState} setLinkPopoverState={setLinkPopoverState} />
    </div>
  );
}

export default function JobDescriptionEditor({ value, onChange }) {
  const initialConfig = {
    namespace: 'JobDescriptionEditor',
    theme,
    nodes: [ListNode, ListItemNode, LinkNode, ParagraphNode, TextNode],
    onError: (error) => console.error('Lexical Error:', error),
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex items-center justify-between mb-1.5 relative">
        <label className="block text-sm font-medium text-slate-700">Description *</label>
        <EditorToolbar />
      </div>
      <div className="w-full input text-sm h-[320px] sm:h-[480px] p-0 relative bg-white overflow-hidden flex flex-col">
        <div className="flex-1 relative overflow-y-auto overscroll-contain [overflow-anchor:none] flex flex-col">
          <RichTextPlugin
            contentEditable={<ContentEditable className="outline-none w-full flex-1 p-4" />}
            placeholder={<div className="absolute top-4 left-4 text-slate-400 pointer-events-none">Enter job description...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin validateUrl={(url) => url.startsWith('https://')} />

        <LinkClickVerificationPlugin />
        <MarkdownShortcutPlugin transformers={PLACEHUB_TRANSFORMERS} />
        <MarkdownPastePlugin />
        <MarkdownInitPlugin initialMarkdown={value} />
        <OnChangePlugin onChange={(editorState) => {
          editorState.read(() => {
            const markdown = $convertToMarkdownString(PLACEHUB_TRANSFORMERS);
            // Lexical adds a trailing newline sometimes, we can trim it if needed or let the backend do it.
            // But we must report exactly the Markdown.
            onChange(markdown);
          });
        }} />
      </div>
    </LexicalComposer>
  );
}
