import { Ionicons } from '@expo/vector-icons';
import { type SFSymbol, SymbolView } from 'expo-symbols';
import React, { type ReactNode } from 'react';
import { Modal, Pressable, type StyleProp, StyleSheet, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { Div } from './Div';
export interface ContextMenuItem {
	label: string;
	systemImage?: SFSymbol;
	icon?: keyof typeof Ionicons.glyphMap;
	onPress: () => void;
	destructive?: boolean;
	disabled?: boolean;
}

interface ContextMenuProps {
	items: ContextMenuItem[];
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, children, style }) => {
	const [visible, setVisible] = React.useState(false);
	const [position, setPosition] = React.useState({ x: 0, y: 0 });
	const triggerRef = React.useRef<View>(null);

	const handlePress = () => {
		if (triggerRef.current) {
			triggerRef.current.measure((_x, _y, _width, height, pageX, pageY) => {
				setPosition({
					x: pageX,
					y: pageY + height,
				});
				setVisible(true);
			});
		}
	};

	const handleItemPress = (item: ContextMenuItem) => {
		if (!item.disabled) {
			setVisible(false);
			item.onPress();
		}
	};

	return (
		<>
			<Pressable ref={triggerRef} onPress={handlePress} style={style}>
				{children}
			</Pressable>

			<Modal visible={visible} transparent animationType='fade' onRequestClose={() => setVisible(false)}>
				<TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
					<Div
						style={[
							styles.menuContainer,
							{
								top: position.y,
								right: 16,
							},
						]}
					>
						{items.map((item, index) => (
							<TouchableOpacity
								key={index}
								style={[
									styles.menuItem,
									item.disabled && styles.menuItemDisabled,
									index !== items.length - 1 && styles.menuItemBorder,
								]}
								onPress={() => handleItemPress(item)}
								disabled={item.disabled}
							>
								<Div style={styles.menuItemContent} transparent>
									{item.systemImage ? (
										<SymbolView
											name={item.systemImage}
											size={18}
											tintColor={item.destructive ? '#ff3b30' : '#fff'}
											style={styles.menuIcon}
										/>
									) : item.icon ? (
										<Ionicons
											name={item.icon}
											size={18}
											color={item.destructive ? '#ff3b30' : '#fff'}
											style={styles.menuIcon}
										/>
									) : null}
									<Text
										style={[
											styles.menuItemText,
											item.destructive && styles.menuItemDestructive,
											item.disabled && styles.menuItemDisabledText,
										]}
									>
										{item.label}
									</Text>
								</Div>
							</TouchableOpacity>
						))}
					</Div>
				</TouchableOpacity>
			</Modal>
		</>
	);
};

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	menuContainer: {
		position: 'absolute',
		minWidth: 200,
		borderRadius: 12,
		backgroundColor: 'rgba(40, 40, 40, 0.95)',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 8,
		overflow: 'hidden',
	},
	menuItem: {
		paddingVertical: 14,
		paddingHorizontal: 16,
	},
	menuItemBorder: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: 'rgba(255, 255, 255, 0.1)',
	},
	menuItemContent: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	menuIcon: {
		marginRight: 12,
	},
	menuItemText: {
		fontSize: 16,
		color: '#fff',
	},
	menuItemDestructive: {
		color: '#ff3b30',
	},
	menuItemDisabled: {
		opacity: 0.4,
	},
	menuItemDisabledText: {
		opacity: 0.4,
	},
});
